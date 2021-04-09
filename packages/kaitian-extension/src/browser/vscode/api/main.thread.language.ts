import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import * as modes from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { StaticServices } from '@ali/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import type { ITextModel } from '@ali/monaco-editor-core/esm/vs/editor/common/model';

import { Autowired, Injectable, Optinal } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { IReporterService, PreferenceService } from '@ali/ide-core-browser';
import { DisposableCollection, Emitter, IMarkerData, LRUMap, MarkerManager, REPORT_NAME, URI } from '@ali/ide-core-common';
import { extname } from '@ali/ide-core-common/lib/path';
import { ICallHierarchyService } from '@ali/ide-monaco/lib/browser/callHierarchy/callHierarchy.service';
import { IEvaluatableExpressionService } from '@ali/ide-debug/lib/browser/editor/evaluatable-expression';
import { applyPatch } from 'diff';
import { DocumentFilter } from 'vscode-languageserver-protocol';
import { ExtHostAPIIdentifier, IExtHostLanguages, IMainThreadLanguages, MonacoModelIdentifier, testGlob } from '../../../common/vscode';
import { fromLanguageSelector } from '../../../common/vscode/converter';
import { CompletionContext, ILink, ISerializedSignatureHelpProviderMetadata, LanguageSelector, SemanticTokensLegend, SerializedDocumentFilter, SerializedLanguageConfiguration, WorkspaceSymbolProvider, ICallHierarchyItemDto, CallHierarchyItem } from '../../../common/vscode/model.api';
import { reviveIndentationRule, reviveOnEnterRules, reviveRegExp, reviveWorkspaceEditDto } from '../../../common/vscode/utils';
import { UriComponents } from '../../../common/vscode/ext-types';
import { ILanguageService } from '@ali/ide-editor';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { DocumentRangeSemanticTokensProviderImpl, DocumentSemanticTokensProvider } from './semantic-tokens/semantic-token-provider';
import { CancellationToken } from 'vscode';

const PATCH_PREFIX = 'Index: a\n===================================================================\n--- a\n+++ a\n';

@Injectable({multiple: true})
export class MainThreadLanguages implements IMainThreadLanguages {
  private readonly proxy: IExtHostLanguages;
  private readonly disposables = new Map<number, monaco.IDisposable>();

  @Autowired(MarkerManager)
  readonly markerManager: MarkerManager;

  @Autowired(PreferenceService)
  preference: PreferenceService;

  @Autowired(IReporterService)
  reporter: IReporterService;

  @Autowired(ILanguageService)
  private readonly languageService: ILanguageService;

  @Autowired(ICallHierarchyService)
  protected readonly callHierarchyService: ICallHierarchyService;
  @Autowired(IEvaluatableExpressionService)
  protected readonly evaluatableExpressionService: IEvaluatableExpressionService;

  @Autowired(IEditorDocumentModelService)
  private readonly documentModelManager: IEditorDocumentModelService;

  private languageFeatureEnabled = new LRUMap<string, boolean>(200, 100);

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy<IExtHostLanguages>(ExtHostAPIIdentifier.ExtHostLanguages);
  }

  public dispose() {
    this.disposables.forEach((disposable) => {
      disposable.dispose();
    });
    this.disposables.clear();
  }

  $unregister(handle) {
    const disposable = this.disposables.get(handle);
    if (disposable) {
      this.disposables.delete(handle);
      disposable.dispose();
    }
  }

  $getLanguages(): string[] {
    return monaco.languages.getLanguages().map((l) => l.id);
  }

  async $changeLanguage(resource: UriComponents, languageId: string): Promise<void> {
    const languageIdentifier = StaticServices.modeService.get().getLanguageIdentifier(languageId);
    if (!languageIdentifier || languageIdentifier.language !== languageId) {
      return Promise.reject(new Error(`Unknown language id: ${languageId}`));
    }

    const uri = new URI(URI.revive(resource));
    const ref = await this.documentModelManager.createModelReference(uri);
    try {
      ref.instance.languageId = languageId;
    } finally {
      ref.dispose();
    }
  }

  isLanguageFeatureEnabled(model: monaco.editor.ITextModel) {
    const uriString = model.uri.toString();
    if (!this.languageFeatureEnabled.has(uriString)) {
      this.languageFeatureEnabled.set(uriString, model.getValueLength() < ( this.preference.get<number>('editor.languageFeatureEnabledMaxSize') || 2 * 1024 * 1024));
    }
    return this.languageFeatureEnabled.get(uriString);
  }

  protected getUniqueLanguages(): string[] {
    const languages: string[] = [];
    // 会有重复
    const allLanguages = monaco.languages.getLanguages().map((l) => l.id);
    for (const language of allLanguages) {
      if (languages.indexOf(language) === -1) {
        languages.push(language);
      }
    }
    return languages;
  }

  $registerHoverProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const hoverProvider = this.createHoverProvider(handle, languageSelector);
    this.disposables.set(handle, modes.HoverProviderRegistry.register(selector, hoverProvider));
  }

  protected createHoverProvider(handle: number, selector?: LanguageSelector): modes.HoverProvider {
    return {
      provideHover: (model, position, token) => {
        // model.ITextModel 与 monaco.editor.ITextModel getOptions EOL部分不兼容，不影响逻辑
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model as unknown as monaco.editor.ITextModel))) {
          return undefined!;
        }
        if (!this.isLanguageFeatureEnabled(model as unknown as monaco.editor.ITextModel)) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_HOVER);
        return this.proxy.$provideHoverWithDuration(handle, model.uri, position, token).then(({ result, _dur }) => {
          if (result) {
            timer.timeEnd(extname(model.uri.fsPath), {
              extDuration: _dur,
            });
          }
          return result!;
        });
      },
    };
  }

  $registerCompletionSupport(handle: number, selector: SerializedDocumentFilter[], triggerCharacters: string[], supportsResolveDetails: boolean): void {
    // NOTE monaco.languages.registerCompletionItemProvider api显示只能传string，实际内部实现支持DocumentSelector
    this.disposables.set(handle, monaco.languages.registerCompletionItemProvider(fromLanguageSelector(selector)! as any, {
      triggerCharacters,
      provideCompletionItems: async (model: monaco.editor.ITextModel, position: monaco.Position, context, token: monaco.CancellationToken) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        const quickSuggestionsMaxCount = this.preference.get('editor.quickSuggestionsMaxCount') || 0;
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_COMPLETION_ITEMS);
        const result = await this.proxy.$provideCompletionItems(handle, model.uri, position, {
          ...context,
          quickSuggestionsMaxCount,
        } as CompletionContext, token);
        if (!result) {
          return undefined!;
        }
        if (result.items.length) {
          timer.timeEnd(extname(model.uri.fsPath), {
            extDuration: (result as any)._dur,
          });
        }
        return {
          suggestions: result.items,
          incomplete: result.isIncomplete,
          dispose: () => {
            if (typeof (result as any)._id === 'number') {
              setTimeout(() => {
                this.proxy.$releaseCompletionItems(handle, (result as any)._id);
              }, 0);
            }
          },
        } as monaco.languages.CompletionList;
      },
      resolveCompletionItem: supportsResolveDetails
        ? (model, position, suggestion, token) => {
          if (!this.isLanguageFeatureEnabled(model)) {
            return undefined!;
          }
          this.reporter.point(REPORT_NAME.RESOLVE_COMPLETION_ITEM);
          return Promise.resolve(this.proxy.$resolveCompletionItem(handle, model.uri, position, suggestion, token) as any);
        }
        : undefined,
    }));
  }

  protected matchLanguage(selector: LanguageSelector | undefined, languageId: string): boolean {
    if (Array.isArray(selector)) {
      return selector.some((filter) => this.matchLanguage(filter, languageId));
    }

    if (DocumentFilter.is(selector)) {
      return !selector.language || selector.language === languageId;
    }

    return selector === languageId;
  }

  protected matchModel(selector: LanguageSelector | undefined, model: MonacoModelIdentifier): boolean {
    if (Array.isArray(selector)) {
      return selector.some((filter) => this.matchModel(filter, model));
    }
    if (DocumentFilter.is(selector)) {
      if (!!selector.language && selector.language !== model.languageId) {
        return false;
      }
      if (!!selector.scheme && selector.scheme !== model.uri.scheme) {
        return false;
      }
      if (!!selector.pattern && !testGlob(selector.pattern, model.uri.path)) {
        return false;
      }
      return true;
    }
    return selector === model.languageId;
  }

  $registerDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const definitionProvider = this.createDefinitionProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDefinitionProvider(language, definitionProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  $registerDeclarationProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    // const definitionProvider = this.createDefinitionProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        // disposable.push(monaco.languages.registerDeclarationProvider(language, definitionProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createDefinitionProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DefinitionProvider {
    return {
      provideDefinition: async (model, position, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DEFINITION);
        const { result, _dur } = await this.proxy.$provideDefinitionWithDuration(handle, model.uri, position, token);

        if (!result) {
          return undefined!;
        }
        timer.timeEnd(extname(model.uri.fsPath), {
          extDuration: _dur,
        });
        if (Array.isArray(result)) {
          const definitionLinks: monaco.languages.LocationLink[] = [];
          for (const item of result) {
            definitionLinks.push({ ...item, uri: monaco.Uri.revive(item.uri) });
          }
          return definitionLinks as monaco.languages.LocationLink[];
        } else {
          // single Location
          return {
            uri: monaco.Uri.revive(result.uri),
            range: result.range,
          } as monaco.languages.Definition;
        }
      },
    };
  }

  $registerTypeDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const typeDefinitionProvider = this.createTypeDefinitionProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerTypeDefinitionProvider(language, typeDefinitionProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createTypeDefinitionProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.TypeDefinitionProvider {
    return {
      provideTypeDefinition: (model, position, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_TYPE_DEFINITION);
        return this.proxy.$provideTypeDefinition(handle, model.uri, position, token).then((result) => {
          if (!result) {
            return undefined!;
          }
          timer.timeEnd(extname(model.uri.fsPath));
          if (Array.isArray(result)) {
            const definitionLinks: monaco.languages.Location[] = [];
            for (const item of result) {
              definitionLinks.push({ ...item, uri: monaco.Uri.revive(item.uri) });
            }
            return definitionLinks;
          } else {
            // single Location
            return {
              uri: monaco.Uri.revive(result.uri),
              range: result.range,
            } as monaco.languages.Location;
          }
        });
      },
    };
  }

  $registerFoldingRangeProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const provider = this.createFoldingRangeProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerFoldingRangeProvider(language, provider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createFoldingRangeProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.FoldingRangeProvider {
    return {
      provideFoldingRanges: (model, context, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_FOLDING_RANGES);
        return this.proxy.$provideFoldingRange(handle, model.uri, context, token).then((v) => {
          if (v) {
            timer.timeEnd(extname(model.uri.fsPath));
          }
          return v!;
        });
      },
    };
  }

  $registerDocumentColorProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const colorProvider = this.createColorProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerColorProvider(language, colorProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createColorProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentColorProvider {
    return {
      provideDocumentColors: (model, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DOCUMENT_COLORS);
        return this.proxy.$provideDocumentColors(handle, model.uri, token).then((documentColors) => {
          timer.timeEnd(extname(model.uri.fsPath));
          return documentColors.map((documentColor) => {
            const [red, green, blue, alpha] = documentColor.color;
            const color = {
              red,
              green,
              blue,
              alpha,
            };
            return {
              color,
              range: documentColor.range,
            };
          });
        });
      },
      provideColorPresentations: (model, colorInfo, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_COLOR_PRESENTATIONS);
        return this.proxy.$provideColorPresentations(handle, model.uri, {
          color: [
            colorInfo.color.red,
            colorInfo.color.green,
            colorInfo.color.blue,
            colorInfo.color.alpha,
          ],
          range: colorInfo.range,
        }, token).then((v) => {
          if (v) {
            timer.timeEnd(extname(model.uri.fsPath));
          }
          return v;
        }) as unknown as PromiseLike<monaco.languages.IColorPresentation[]>;
      },
    };
  }

  $registerDocumentHighlightProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const documentHighlightProvider = this.createDocumentHighlightProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDocumentHighlightProvider(language, documentHighlightProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createDocumentHighlightProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentHighlightProvider {
    return {
      provideDocumentHighlights: (model, position, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DOCUMENT_HIGHLIGHTS);
        return this.proxy.$provideDocumentHighlights(handle, model.uri, position, token).then((result) => {
          if (!result) {
            return undefined!;
          }
          if (Array.isArray(result)) {
            timer.timeEnd(extname(model.uri.fsPath));
            const highlights: monaco.languages.DocumentHighlight[] = [];
            for (const item of result) {
              highlights.push(
                {
                  ...item,
                  kind: (item.kind !== undefined ? item.kind : monaco.languages.DocumentHighlightKind.Text),
                });
            }
            return highlights;
          }

          return undefined!;
        });

      },
    };
  }

  $registerDocumentFormattingProvider(handle: number, displayName: string, selector: SerializedDocumentFilter[]) {
    const languageSelector = fromLanguageSelector(selector);
    const documentFormattingEditProvider = this.createDocumentFormattingEditProvider(handle, displayName, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDocumentFormattingEditProvider(language, documentFormattingEditProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createDocumentFormattingEditProvider( handle: number, displayName: string, selector: LanguageSelector | undefined): monaco.languages.DocumentFormattingEditProvider {
    return {
      displayName,
      provideDocumentFormattingEdits: async (model, options) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DOCUMENT_FORMATTING_EDITS);
        return this.proxy.$provideDocumentFormattingEdits(handle, model.uri, options).then((result) => {
          timer.timeEnd(extname(model.uri.fsPath));
          if (!result) {
            return undefined;
          }
          return result;
        });
      },
    };
  }

  $registerRangeFormattingProvider(handle: number, displayName: string, selector: SerializedDocumentFilter[]) {
    const languageSelector = fromLanguageSelector(selector);
    const documentHighlightProvider = this.createDocumentRangeFormattingEditProvider(handle, displayName, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDocumentRangeFormattingEditProvider(language, documentHighlightProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createDocumentRangeFormattingEditProvider(handle: number, displayName: string, selector: LanguageSelector | undefined): monaco.languages.DocumentRangeFormattingEditProvider {
    return {
      displayName,
      provideDocumentRangeFormattingEdits: async (model, range, options) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DOCUMENT_RANGE_FORMATTING_EDITS);
        return this.proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options).then((result) => {
          timer.timeEnd(extname(model.uri.fsPath));
          if (!result) {
            return undefined;
          }
          // 从 diff patch 来恢复文档
          if (result.length === 1 && result[0].onlyPatch) {
            result[0].text = applyPatch(model.getValue(), PATCH_PREFIX + result[0].text);
            result[0].onlyPatch = false;
          }
          return result;
        });
      },
    };
  }

  $registerOnTypeFormattingProvider(handle: number, selector: SerializedDocumentFilter[], autoFormatTriggerCharacters: string[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const onTypeFormattingProvider = this.createOnTypeFormattingProvider(handle, languageSelector, autoFormatTriggerCharacters);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerOnTypeFormattingEditProvider(language, onTypeFormattingProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createOnTypeFormattingProvider(
    handle: number,
    selector: LanguageSelector | undefined,
    autoFormatTriggerCharacters: string[],
  ): monaco.languages.OnTypeFormattingEditProvider {
    return {
      autoFormatTriggerCharacters,
      provideOnTypeFormattingEdits: async (model, position, ch, options) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_ON_TYPE_FORMATTING_EDITS);
        return this.proxy.$provideOnTypeFormattingEditsWithDuration(handle, model.uri, position, ch, options).then(({ result, _dur }) => {
          if (result) {
            timer.timeEnd(extname(model.uri.fsPath), {
              extDuration: _dur,
            });
          }
          return result!;
        });
      },
    };
  }

  $registerCodeLensSupport(handle: number, selector: SerializedDocumentFilter[], eventHandle: number): void {
    const languageSelector = fromLanguageSelector(selector);
    const lensProvider = this.createCodeLensProvider(handle, languageSelector);

    if (typeof eventHandle === 'number') {
      const emitter = new Emitter<monaco.languages.CodeLensProvider>();
      this.disposables.set(eventHandle, emitter);
      lensProvider.onDidChange = emitter.event;
    }

    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerCodeLensProvider(language, lensProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createCodeLensProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.CodeLensProvider {
    return {
      provideCodeLenses: (model, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_CODE_LENSES);
        return this.proxy.$provideCodeLenses(handle, model.uri).then((v) => {
          if (v) {
            timer.timeEnd(extname(model.uri.fsPath));
          }
          return v!;
        });
      },
      resolveCodeLens: (model, codeLens, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        this.reporter.point(REPORT_NAME.RESOLVE_CODE_LENS);
        return this.proxy.$resolveCodeLens(handle, model.uri, codeLens).then((v) => v!);
      },
    };
  }

  $emitCodeLensEvent(eventHandle: number, event?: any): void {
    // FIXME: 由于 IDisposable 本身不是 Emitter 的实例，因此以下代码并不会执行
    const obj = this.disposables.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }

  $clearDiagnostics(id: string): void {
    this.markerManager.clearMarkers(id);
  }

  $changeDiagnostics(id: string, delta: [string, IMarkerData[]][]): void {
    for (const [uriString, markers] of delta) {
      this.markerManager.updateMarkers(id, uriString, markers);
    }
  }

  $registerImplementationProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const implementationProvider = this.createImplementationProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerImplementationProvider(language, implementationProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  $registerDocumentLinkProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const linkProvider = this.createLinkProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerLinkProvider(language, linkProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createImplementationProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.ImplementationProvider {
    return {
      provideImplementation: (model, position, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_IMPLEMENTATION);
        return this.proxy.$provideImplementationWithDuration(handle, model.uri, position).then(({result, _dur}) => {
          if (!result) {
            return undefined!;
          }
          timer.timeEnd(extname(model.uri.fsPath), {
            extDuration: _dur,
          });
          if (Array.isArray(result)) {
            // using DefinitionLink because Location is mandatory part of DefinitionLink
            const definitionLinks: any[] = [];
            for (const item of result) {
              definitionLinks.push({ ...item, uri: monaco.Uri.revive(item.uri) });
            }
            return definitionLinks;
          } else {
            // single Location
            return {
              uri: monaco.Uri.revive(result.uri),
              range: result.range,
            } as monaco.languages.Location;
          }
        });
      },
    };
  }

  $registerQuickFixProvider(handle: number, selector: SerializedDocumentFilter[], codeActionKinds?: string[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const quickFixProvider = this.createQuickFixProvider(handle, languageSelector, codeActionKinds);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        // 这里直接使用 modes.CodeActionProviderRegistry 来注册 QuickFixProvider,
        // 因为 monaco.languages.registerCodeActionProvider 过滤掉了 CodeActionKinds 参数
        // 会导致 supportedCodeAction ContextKey 失效，右键菜单缺失了 Refactor 和 Source Action
        disposable.push(
          modes.CodeActionProviderRegistry.register(language, quickFixProvider),
        );
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createQuickFixProvider(handle: number, selector: LanguageSelector | undefined, providedCodeActionKinds?: string[]): modes.CodeActionProvider {
    return {
      provideCodeActions: (model, rangeOrSelection, monacoContext) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_CODE_ACTIONS);
        return this.proxy.$provideCodeActions(handle, model.uri, rangeOrSelection, monacoContext).then((v) => {
          timer.timeEnd(extname(model.uri.fsPath));
          return v;
        });
      },
      providedCodeActionKinds, // 不在monaco.d.ts中
    } as unknown as  modes.CodeActionProvider;
  }

  protected createLinkProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.LinkProvider {
    return {
      provideLinks: (model, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_LINKS);
        return this.proxy.$provideDocumentLinks(handle, model.uri, token).then((modelLinks) => {
          if (!modelLinks) {
            return undefined;
          }
          timer.timeEnd(extname(model.uri.fsPath));
          const links = modelLinks.map((link) => this.reviveLink(link));
          return {
            links,
            dispose: () => {
              // console.warn('TODO 需要传递handleId实现release');
            },
          };
        });
      },
      resolveLink: (link: monaco.languages.ILink, token) => {
        return this.proxy.$resolveDocumentLink(handle, link, token).then((v) => {
          if (!v) {
            return undefined;
          }
          return this.reviveLink(v);
        });
      },
    };
  }

  reviveLink(data: ILink) {
    if (data.url && typeof data.url !== 'string') {
      data.url = URI.revive(data.url);
    }
    return data as monaco.languages.ILink;
  }

  $setLanguageConfiguration(handle: number, languageId: string, configuration: SerializedLanguageConfiguration): void {
    const config: monaco.languages.LanguageConfiguration = {
      comments: configuration.comments,
      brackets: configuration.brackets,
      wordPattern: reviveRegExp(configuration.wordPattern),
      indentationRules: reviveIndentationRule(configuration.indentationRules),
      onEnterRules: reviveOnEnterRules(configuration.onEnterRules),
    };

    this.disposables.set(handle, monaco.languages.setLanguageConfiguration(languageId, config));
  }

  $registerReferenceProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const referenceProvider = this.createReferenceProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerReferenceProvider(language, referenceProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createReferenceProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.ReferenceProvider {
    return {
      provideReferences: (model, position, context, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_REFERENCES);
        return this.proxy.$provideReferencesWithDuration(handle, model.uri, position, context, token).then(({result, _dur}) => {
          if (!result) {
            return undefined!;
          }

          if (Array.isArray(result)) {
            timer.timeEnd(extname(model.uri.fsPath), {
              extDuration: _dur,
            });
            const references: monaco.languages.Location[] = [];
            for (const item of result) {
              references.push({ ...item, uri: monaco.Uri.revive(item.uri) });
            }
            return references;
          }

          return undefined!;
        });
      },
    };
  }

  $registerWorkspaceSymbolProvider(handle: number): void {
    const workspaceSymbolProvider = this.createWorkspaceSymbolProvider(handle);
    this.disposables.set(handle, this.languageService.registerWorkspaceSymbolProvider(workspaceSymbolProvider));
  }

  protected createWorkspaceSymbolProvider(handle: number): WorkspaceSymbolProvider {
    return {
      provideWorkspaceSymbols: (params, token) => this.proxy.$provideWorkspaceSymbols(handle, params.query, token),
      resolveWorkspaceSymbol: (symbol, token) => this.proxy.$resolveWorkspaceSymbol(handle, symbol, token),
    };
  }

  $registerOutlineSupport(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const symbolProvider = this.createDocumentSymbolProvider(handle, languageSelector);

    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDocumentSymbolProvider(language, symbolProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createDocumentSymbolProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentSymbolProvider {
    return {
      provideDocumentSymbols: (model, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DOCUMENT_SYMBOLS);
        return this.proxy.$provideDocumentSymbols(handle, model.uri, token).then((v) => {
          if (v) {
            timer.timeEnd(extname(model.uri.fsPath));
          }
          return v!;
        });
      },
    };
  }

  $registerSignatureHelpProvider(handle: number, selector: SerializedDocumentFilter[], metadata: ISerializedSignatureHelpProviderMetadata): void {
    const languageSelector = fromLanguageSelector(selector);
    const signatureHelpProvider = this.createSignatureHelpProvider(handle, languageSelector, metadata);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerSignatureHelpProvider(language, signatureHelpProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createSignatureHelpProvider(handle: number, selector: LanguageSelector | undefined, metadata: ISerializedSignatureHelpProviderMetadata): monaco.languages.SignatureHelpProvider {
    return {
      signatureHelpTriggerCharacters: metadata.triggerCharacters,
      signatureHelpRetriggerCharacters: metadata.retriggerCharacters,
      provideSignatureHelp: (model, position, token, context) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_SIGNATURE_HELP);
        return this.proxy.$provideSignatureHelp(handle, model.uri, position, context, token).then((v) => {
          if (v) {
            timer.timeEnd(extname(model.uri.fsPath));
          }
          return v!;
        });
      },
    };
  }
  $registerRenameProvider(handle: number, selector: SerializedDocumentFilter[], supportsResolveLocation: boolean): void {
    const languageSelector = fromLanguageSelector(selector);
    const renameProvider = this.createRenameProvider(handle, languageSelector, supportsResolveLocation);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerRenameProvider(language, renameProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createRenameProvider(handle: number, selector: LanguageSelector | undefined, supportsResolveLocation: boolean): monaco.languages.RenameProvider {
    return {
      provideRenameEdits: (model, position, newName, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_RENAME_EDITS);
        return this.proxy.$provideRenameEdits(handle, model.uri, position, newName, token)
          .then((v) => {
            if (v) {
              timer.timeEnd(extname(model.uri.fsPath));
            }
            return reviveWorkspaceEditDto(v!);
          });
      },
      resolveRenameLocation: supportsResolveLocation
        ? (model, position, token) => {
          if (!this.isLanguageFeatureEnabled(model)) {
            return undefined!;
          }
          if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
            return undefined!;
          }
          return this.proxy.$resolveRenameLocation(handle, model.uri, position, token).then((v) => v!);
        }
        : undefined,
    };
  }

  $registerSelectionRangeProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const selectionRangeProvider = this.createSelectionProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerSelectionRangeProvider(language, selectionRangeProvider));
      }
    }

    this.disposables.set(handle, disposable);
  }

  protected createSelectionProvider(handle: number, selector?: LanguageSelector): monaco.languages.SelectionRangeProvider {
    return {
      provideSelectionRanges: (model, positions, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }

        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined!;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_SELECTION_RANGES);
        return this.proxy.$provideSelectionRanges(handle, model.uri, positions, token).then((v) => {
          timer.timeEnd(extname(model.uri.fsPath));
          return v;
        });
      },
    };
  }

  $registerCallHierarchyProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const provider = this.createCallHierarchyProvider(handle, languageSelector);
    // @ts-ignore
    this.callHierarchyService.registerCallHierarchyProvider(selector, provider);
  }

  private reviveCallHierarchyItemDto(data: ICallHierarchyItemDto | undefined): CallHierarchyItem {
    if (data) {
      data.uri = URI.revive(data.uri);
    }
    return data as CallHierarchyItem;
  }

  protected createCallHierarchyProvider(handle: number, selector: LanguageSelector | undefined) {
    return {
      prepareCallHierarchy: async (document, position, token) => {
        const items = await this.proxy.$prepareCallHierarchy(handle, document.uri, position, token);
        if (!items) {
          return undefined;
        }
        return {
          dispose: () => {
            for (const item of items) {
              this.proxy.$releaseCallHierarchy(handle, item._sessionId);
            }
          },
          roots: items.map(this.reviveCallHierarchyItemDto),
        };
      },

      provideOutgoingCalls: async (item, token) => {
        const outgoing = await this.proxy.$provideCallHierarchyOutgoingCalls(handle, item._sessionId, item._itemId, token);
        if (!outgoing) {
          return outgoing;
        }
        outgoing.forEach((value) => {
          value.to = this.reviveCallHierarchyItemDto(value.to);
        });
        return outgoing;
      },
      provideIncomingCalls: async (item, token) => {
        const incoming = await this.proxy.$provideCallHierarchyIncomingCalls(handle, item._sessionId, item._itemId, token);
        if (!incoming) {
          return incoming;
        }
        incoming.forEach((value) => {
          value.from = this.reviveCallHierarchyItemDto(value.from);
        });
        return incoming;
      },
    };
  }
  //#region Semantic Tokens
  $registerDocumentSemanticTokensProvider(handle: number, selector: SerializedDocumentFilter[], legend: SemanticTokensLegend): void {
    const provider = new DocumentSemanticTokensProvider(this.proxy, handle, legend);
    this.disposables.set(handle, modes.DocumentSemanticTokensProviderRegistry.register(fromLanguageSelector(selector)! as unknown as string, provider));
  }

  $registerDocumentRangeSemanticTokensProvider(handle: number, selector: SerializedDocumentFilter[], legend: SemanticTokensLegend): void {
    const provider = new DocumentRangeSemanticTokensProviderImpl(this.proxy, handle, legend);
    this.disposables.set(handle, modes.DocumentRangeSemanticTokensProviderRegistry.register(fromLanguageSelector(selector)! as unknown as string, provider));
  }
  //#endregion Semantic Tokens

  //#region EvaluatableExpression
  $registerEvaluatableExpressionProvider(handler: number, selector: SerializedDocumentFilter[]): void {
    const provider = {
      provideEvaluatableExpression: (model: ITextModel, position: monaco.Position, token: CancellationToken) => {
        return this.proxy.$provideEvaluatableExpression(handler, model.uri, position, token);
      },
    };
    this.disposables.set(handler, this.evaluatableExpressionService.registerEvaluatableExpressionProvider(selector, provider));
  }
  //#endregion EvaluatableExpression
}
