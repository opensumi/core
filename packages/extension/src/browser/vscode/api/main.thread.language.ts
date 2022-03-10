import { CancellationToken } from 'vscode';
import { DocumentFilter } from 'vscode-languageserver-protocol';

import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { IReporterService, PreferenceService } from '@opensumi/ide-core-browser';
import {
  DisposableCollection,
  Emitter,
  IDisposable,
  IMarkerData,
  IRange,
  LRUMap,
  MarkerManager,
  REPORT_NAME,
  URI,
} from '@opensumi/ide-core-common';
import { extname } from '@opensumi/ide-core-common/lib/path';
import { IEvaluatableExpressionService } from '@opensumi/ide-debug/lib/browser/editor/evaluatable-expression';
import { InlineValuesProviderRegistry } from '@opensumi/ide-debug/lib/browser/editor/inline-values';
import { InlineValueContext, InlineValuesProvider, InlineValue } from '@opensumi/ide-debug/lib/common/inline-values';
import { ILanguageService } from '@opensumi/ide-editor';
import {
  IEditorDocumentModelService,
  ILanguageStatus,
  ILanguageStatusService,
  LanguageSelector,
} from '@opensumi/ide-editor/lib/browser';
import { ICallHierarchyService } from '@opensumi/ide-monaco/lib/browser/contrib/callHierarchy';
import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as modes from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { StaticServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';


import {
  ExtHostAPIIdentifier,
  ICodeActionDto,
  ICodeActionProviderMetadataDto,
  IExtHostLanguages,
  IMainThreadLanguages,
  ISuggestDataDto,
  ISuggestDataDtoField,
  ISuggestResultDtoField,
  MonacoModelIdentifier,
  RangeSuggestDataDto,
  testGlob,
} from '../../../common/vscode';
import { fromLanguageSelector } from '../../../common/vscode/converter';
import { UriComponents } from '../../../common/vscode/ext-types';
import { IExtensionDescription } from '../../../common/vscode/extension';
import {
  ILink,
  ISerializedSignatureHelpProviderMetadata,
  SemanticTokensLegend,
  SerializedDocumentFilter,
  SerializedLanguageConfiguration,
  WorkspaceSymbolProvider,
  ICallHierarchyItemDto,
  CallHierarchyItem,
  IWorkspaceEditDto,
  ResourceTextEditDto,
  ResourceFileEditDto,
  ILinkDto,
} from '../../../common/vscode/model.api';
import { FoldingRangeProvider } from '../../../common/vscode/model.api';
import { mixin, reviveIndentationRule, reviveOnEnterRules, reviveRegExp } from '../../../common/vscode/utils';


import {
  DocumentRangeSemanticTokensProviderImpl,
  DocumentSemanticTokensProvider,
} from './semantic-tokens/semantic-token-provider';


@Injectable({ multiple: true })
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

  @Autowired(ILanguageStatusService)
  private readonly languageStatusService: ILanguageStatusService;

  private languageFeatureEnabled = new LRUMap<string, boolean>(200, 100);

  private _reviveCodeActionDto(data: ReadonlyArray<ICodeActionDto>): modes.CodeAction[] {
    if (data) {
      data.forEach((code) => this.reviveWorkspaceEditDto(code.edit));
    }
    return data as modes.CodeAction[];
  }

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
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

  isLanguageFeatureEnabled(model: ITextModel) {
    const uriString = model.uri.toString();
    if (!this.languageFeatureEnabled.has(uriString)) {
      this.languageFeatureEnabled.set(
        uriString,
        model.getValueLength() <
          (this.preference.get<number>('editor.languageFeatureEnabledMaxSize') || 2 * 1024 * 1024),
      );
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
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
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

  private isDeflatedSuggestDto(data: ISuggestDataDto | modes.CompletionItem) {
    return (
      data[ISuggestDataDtoField.label] ||
      data[ISuggestDataDtoField.kind] ||
      data[ISuggestDataDtoField.kindModifier] ||
      data[ISuggestDataDtoField.detail] ||
      data[ISuggestDataDtoField.documentation] ||
      data[ISuggestDataDtoField.sortText] ||
      data[ISuggestDataDtoField.filterText] ||
      data[ISuggestDataDtoField.preselect] ||
      data[ISuggestDataDtoField.range] ||
      data[ISuggestDataDtoField.insertTextRules] ||
      data[ISuggestDataDtoField.commitCharacters] ||
      data[ISuggestDataDtoField.insertText] ||
      data[ISuggestDataDtoField.command]
    );
  }

  private inflateLabel(label: string | modes.CompletionItemLabel): string | modes.CompletionItemLabel {
    if (typeof label === 'object') {
      return label;
    }
    const splitted = label.split('~|');
    if (Array.isArray(splitted) && splitted.length > 1) {
      return {
        label: splitted[0],
        description: splitted[1],
        detail: splitted[2],
      };
    }
    return label;
  }

  private inflateSuggestDto(
    defaultRange: IRange | { insert: IRange; replace: IRange },
    data: ISuggestDataDto,
  ): modes.CompletionItem {
    if (!this.isDeflatedSuggestDto(data)) {
      return data as unknown as modes.CompletionItem;
    }
    const label = this.inflateLabel(data[ISuggestDataDtoField.label] as unknown as string);

    return {
      label,
      kind: data[ISuggestDataDtoField.kind] ?? modes.CompletionItemKind.Property,
      tags: data[ISuggestDataDtoField.kindModifier],
      detail: data[ISuggestDataDtoField.detail],
      documentation: data[ISuggestDataDtoField.documentation],
      sortText: data[ISuggestDataDtoField.sortText],
      filterText: data[ISuggestDataDtoField.filterText],
      preselect: data[ISuggestDataDtoField.preselect],
      insertText: data[ISuggestDataDtoField.insertText] ?? (typeof label === 'string' ? label : label.label),
      // @ts-ignore
      range: RangeSuggestDataDto.from(data[ISuggestDataDtoField.range]) ?? defaultRange,
      insertTextRules: data[ISuggestDataDtoField.insertTextRules],
      commitCharacters: data[ISuggestDataDtoField.commitCharacters],
      additionalTextEdits: data[ISuggestDataDtoField.additionalTextEdits],
      command: data[ISuggestDataDtoField.command],
      _id: data.x,
    };
  }

  $registerCompletionSupport(
    handle: number,
    selector: SerializedDocumentFilter[],
    triggerCharacters: string[],
    supportsResolveDetails: boolean,
  ): void {
    // NOTE monaco.languages.registerCompletionItemProvider api显示只能传string，实际内部实现支持DocumentSelector
    this.disposables.set(
      handle,
      monaco.languages.registerCompletionItemProvider(fromLanguageSelector(selector)! as any, {
        triggerCharacters,
        provideCompletionItems: async (
          model: ITextModel,
          position: monaco.Position,
          context,
          token: monaco.CancellationToken,
        ) => {
          if (!this.isLanguageFeatureEnabled(model)) {
            return undefined;
          }
          const timer = this.reporter.time(REPORT_NAME.PROVIDE_COMPLETION_ITEMS);
          const result = await this.proxy.$provideCompletionItems(handle, model.uri, position, context, token);
          if (!result) {
            return undefined;
          }

          if (result[ISuggestResultDtoField.completions].length) {
            timer.timeEnd(extname(model.uri.fsPath), {
              extDuration: result.d,
            });
          }
          const suggestions = result[ISuggestResultDtoField.completions].map((data) =>
            this.inflateSuggestDto(result[ISuggestResultDtoField.defaultRanges], data),
          ) as unknown as monaco.languages.CompletionItem[];
          return {
            suggestions,
            duration: result[ISuggestResultDtoField.duration],
            incomplete: result[ISuggestResultDtoField.isIncomplete] || false,
            dispose: () => {
              if (result.x) {
                setTimeout(() => {
                  this.proxy.$releaseCompletionItems(handle, result.x!);
                }, 0);
              }
            },
          };
        },
        resolveCompletionItem: supportsResolveDetails
          ? async (suggestion, token) => {
              this.reporter.point(REPORT_NAME.RESOLVE_COMPLETION_ITEM);
              return this.proxy.$resolveCompletionItem(handle, suggestion._id!, token).then((result) => {
                if (!result) {
                  return suggestion;
                }
                const newSuggestion = this.inflateSuggestDto(suggestion.range, result);
                return mixin(suggestion, newSuggestion, true);
              });
            }
          : undefined,
      }),
    );
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

  protected createDefinitionProvider(
    handle: number,
    selector: LanguageSelector | undefined,
  ): monaco.languages.DefinitionProvider {
    return {
      provideDefinition: async (model, position, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DEFINITION);
        const { result, _dur } = await this.proxy.$provideDefinitionWithDuration(handle, model.uri, position, token);

        if (!result) {
          return undefined;
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

  protected createTypeDefinitionProvider(
    handle: number,
    selector: LanguageSelector | undefined,
  ): monaco.languages.TypeDefinitionProvider {
    return {
      provideTypeDefinition: (model, position, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_TYPE_DEFINITION);
        return this.proxy.$provideTypeDefinition(handle, model.uri, position, token).then((result) => {
          if (!result) {
            return undefined;
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

  $registerFoldingRangeProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    eventHandle: number | undefined,
  ): void {
    const languageSelector = fromLanguageSelector(selector);
    const provider = this.createFoldingRangeProvider(handle, languageSelector);

    if (typeof eventHandle === 'number') {
      const emitter = new Emitter<modes.FoldingRangeProvider>();
      this.disposables.set(eventHandle, emitter);
      provider.onDidChange = emitter.event;
    }

    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerFoldingRangeProvider(language, provider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  $emitFoldingRangeEvent(eventHandle: number, event?: any): void {
    const obj = this.disposables.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }

  createFoldingRangeProvider(handle: number, selector: LanguageSelector | undefined): FoldingRangeProvider {
    return {
      provideFoldingRanges: (model, context, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
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
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
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
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_COLOR_PRESENTATIONS);
        return this.proxy
          .$provideColorPresentations(
            handle,
            model.uri,
            {
              color: [colorInfo.color.red, colorInfo.color.green, colorInfo.color.blue, colorInfo.color.alpha],
              range: colorInfo.range,
            },
            token,
          )
          .then((v) => {
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

  protected createDocumentHighlightProvider(
    handle: number,
    selector: LanguageSelector | undefined,
  ): monaco.languages.DocumentHighlightProvider {
    return {
      provideDocumentHighlights: (model, position, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DOCUMENT_HIGHLIGHTS);
        return this.proxy.$provideDocumentHighlights(handle, model.uri, position, token).then((result) => {
          if (!result) {
            return undefined;
          }
          if (Array.isArray(result)) {
            timer.timeEnd(extname(model.uri.fsPath));
            const highlights: monaco.languages.DocumentHighlight[] = [];
            for (const item of result) {
              highlights.push({
                ...item,
                kind: item.kind !== undefined ? item.kind : monaco.languages.DocumentHighlightKind.Text,
              });
            }
            return highlights;
          }

          return undefined;
        });
      },
    };
  }

  $registerDocumentFormattingProvider(
    handle: number,
    extension: IExtensionDescription,
    selector: SerializedDocumentFilter[],
  ) {
    const languageSelector = fromLanguageSelector(selector);
    const documentFormattingEditProvider = this.createDocumentFormattingEditProvider(
      handle,
      extension,
      languageSelector,
    );
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(
          monaco.languages.registerDocumentFormattingEditProvider(language, documentFormattingEditProvider),
        );
      }
    }
    this.disposables.set(handle, disposable);
  }

  createDocumentFormattingEditProvider(
    handle: number,
    extension: IExtensionDescription,
    selector: LanguageSelector | undefined,
  ): monaco.languages.DocumentFormattingEditProvider {
    return {
      displayName: extension.displayName,
      extensionId: extension.id,
      provideDocumentFormattingEdits: async (model, options) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
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

  $registerRangeFormattingProvider(
    handle: number,
    extension: IExtensionDescription,
    selector: SerializedDocumentFilter[],
  ) {
    const languageSelector = fromLanguageSelector(selector);
    const documentHighlightProvider = this.createDocumentRangeFormattingEditProvider(
      handle,
      extension,
      languageSelector,
    );
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(
          monaco.languages.registerDocumentRangeFormattingEditProvider(language, documentHighlightProvider),
        );
      }
    }
    this.disposables.set(handle, disposable);
  }

  createDocumentRangeFormattingEditProvider(
    handle: number,
    extension: IExtensionDescription,
    selector: LanguageSelector | undefined,
  ): monaco.languages.DocumentRangeFormattingEditProvider {
    return {
      displayName: extension.displayName,
      extensionId: extension.id,
      provideDocumentRangeFormattingEdits: async (model, range, options) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_DOCUMENT_RANGE_FORMATTING_EDITS);
        return this.proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options).then((result) => {
          timer.timeEnd(extname(model.uri.fsPath));
          if (!result) {
            return undefined;
          }
          return result;
        });
      },
    };
  }

  $registerOnTypeFormattingProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    autoFormatTriggerCharacters: string[],
  ): void {
    const languageSelector = fromLanguageSelector(selector);
    const onTypeFormattingProvider = this.createOnTypeFormattingProvider(
      handle,
      languageSelector,
      autoFormatTriggerCharacters,
    );
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
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_ON_TYPE_FORMATTING_EDITS);
        return this.proxy
          .$provideOnTypeFormattingEditsWithDuration(handle, model.uri, position, ch, options)
          .then(({ result, _dur }) => {
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
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_CODE_LENSES);
        return this.proxy.$provideCodeLenses(handle, model.uri, token).then((dto) => {
          if (dto) {
            timer.timeEnd(extname(model.uri.fsPath));
          }
          return {
            lenses: dto?.lenses || [],
            dispose: () => dto?.cacheId && this.proxy.$releaseCodeLens(handle, dto.cacheId),
          };
        });
      },
      resolveCodeLens: async (model, codeLens, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        this.reporter.point(REPORT_NAME.RESOLVE_CODE_LENS);
        return this.proxy.$resolveCodeLens(handle, codeLens, token).then((v) => v!);
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

  $registerDocumentLinkProvider(handle: number, selector: SerializedDocumentFilter[], supportsResolve: boolean): void {
    const languageSelector = fromLanguageSelector(selector);
    const linkProvider = this.createLinkProvider(handle, supportsResolve);
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerLinkProvider(language, linkProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createImplementationProvider(
    handle: number,
    selector: LanguageSelector | undefined,
  ): monaco.languages.ImplementationProvider {
    return {
      provideImplementation: (model, position, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_IMPLEMENTATION);
        return this.proxy.$provideImplementationWithDuration(handle, model.uri, position).then(({ result, _dur }) => {
          if (!result) {
            return undefined;
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

  $registerQuickFixProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    metadata: ICodeActionProviderMetadataDto,
    displayName: string,
    supportResolve: boolean,
  ): void {
    const languageSelector = fromLanguageSelector(selector);
    const quickFixProvider = this.createQuickFixProvider(
      handle,
      languageSelector,
      metadata,
      displayName,
      supportResolve,
    );
    const disposable = new DisposableCollection();
    for (const language of this.getUniqueLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        // 这里直接使用 modes.CodeActionProviderRegistry 来注册 QuickFixProvider,
        // 因为 monaco.languages.registerCodeActionProvider 过滤掉了 CodeActionKinds 参数
        // 会导致 supportedCodeAction ContextKey 失效，右键菜单缺失了 Refactor 和 Source Action
        disposable.push(modes.CodeActionProviderRegistry.register(language, quickFixProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createQuickFixProvider(
    handle: number,
    selector: LanguageSelector | undefined,
    metadata: ICodeActionProviderMetadataDto,
    displayName: string,
    supportsResolve: boolean,
  ): modes.CodeActionProvider {
    const provider: modes.CodeActionProvider = {
      provideCodeActions: async (model: any, rangeOrSelection, monacoContext) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_CODE_ACTIONS);
        const listDto = await this.proxy
          .$provideCodeActions(handle, model.uri, rangeOrSelection, monacoContext)
          .then((v) => {
            timer.timeEnd(extname(model.uri.fsPath));
            return v;
          });
        if (!listDto) {
          return undefined;
        }
        return {
          actions: this._reviveCodeActionDto(listDto.actions),
          dispose: () => {
            if (typeof listDto.cacheId === 'number') {
              this.proxy.$releaseCodeActions(handle, listDto.cacheId);
            }
          },
        };
      },
      documentation: metadata.documentation,
      providedCodeActionKinds: metadata.providedKinds,
      displayName,
    };
    if (supportsResolve) {
      provider.resolveCodeAction = async (codeAction: modes.CodeAction, token: CancellationToken) => {
        const data = await this.proxy.$resolveCodeAction(handle, (codeAction as ICodeActionDto).cacheId!, token);
        codeAction.edit = this.reviveWorkspaceEditDto(data);
        return codeAction;
      };
    }
    return provider;
  }

  protected createLinkProvider(handle: number, supportResolve: boolean): monaco.languages.LinkProvider {
    const provider: monaco.languages.LinkProvider = {
      provideLinks: (model, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_LINKS);
        return this.proxy.$provideDocumentLinks(handle, model.uri, token).then((linksDto) => {
          if (!linksDto) {
            return undefined;
          }
          timer.timeEnd(extname(model.uri.fsPath));
          const links = linksDto.links.map((link) => this.reviveLink(link));
          return {
            links,
            dispose: () => {
              if (linksDto.id) {
                this.proxy.$releaseDocumentLinks(handle, linksDto.id);
              }
            },
          };
        });
      },
    };

    if (supportResolve) {
      provider.resolveLink = (link: monaco.languages.ILink, token) => {
        const dto: ILinkDto = link;
        if (!dto.cacheId) {
          return link;
        }
        return this.proxy.$resolveDocumentLink(handle, dto.cacheId, token).then((v) => {
          if (!v) {
            return undefined;
          }
          return this.reviveLink(v);
        });
      };
    }
    return provider;
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

  protected createReferenceProvider(
    handle: number,
    selector: LanguageSelector | undefined,
  ): monaco.languages.ReferenceProvider {
    return {
      provideReferences: (model, position, context, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_REFERENCES);
        return this.proxy
          .$provideReferencesWithDuration(handle, model.uri, position, context, token)
          .then(({ result, _dur }) => {
            if (!result) {
              return undefined;
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

            return undefined;
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

  protected createDocumentSymbolProvider(
    handle: number,
    selector: LanguageSelector | undefined,
  ): monaco.languages.DocumentSymbolProvider {
    return {
      provideDocumentSymbols: (model, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
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

  $registerSignatureHelpProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    metadata: ISerializedSignatureHelpProviderMetadata,
  ): void {
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

  protected createSignatureHelpProvider(
    handle: number,
    selector: LanguageSelector | undefined,
    metadata: ISerializedSignatureHelpProviderMetadata,
  ): monaco.languages.SignatureHelpProvider {
    return {
      signatureHelpTriggerCharacters: metadata.triggerCharacters,
      signatureHelpRetriggerCharacters: metadata.retriggerCharacters,
      provideSignatureHelp: (model, position, token, context) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_SIGNATURE_HELP);
        return this.proxy.$provideSignatureHelp(handle, model.uri, position, context, token).then((v) => {
          if (!v) {
            return undefined;
          }

          timer.timeEnd(extname(model.uri.fsPath));
          return {
            value: v,
            dispose: () => v.id && this.proxy.$releaseSignatureHelp(handle, v.id),
          };
        });
      },
    };
  }
  $registerRenameProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    supportsResolveLocation: boolean,
  ): void {
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

  protected createRenameProvider(
    handle: number,
    selector: LanguageSelector | undefined,
    supportsResolveLocation: boolean,
  ): monaco.languages.RenameProvider {
    return {
      provideRenameEdits: (model, position, newName, token) => {
        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
        }
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }
        const timer = this.reporter.time(REPORT_NAME.PROVIDE_RENAME_EDITS);
        return this.proxy.$provideRenameEdits(handle, model.uri, position, newName, token).then((v) => {
          if (v) {
            timer.timeEnd(extname(model.uri.fsPath));
          }
          return this.reviveWorkspaceEditDto(v!);
        });
      },
      resolveRenameLocation: supportsResolveLocation
        ? (model, position, token) => {
            if (!this.isLanguageFeatureEnabled(model)) {
              return undefined;
            }
            if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
              return undefined;
            }
            return this.proxy.$resolveRenameLocation(handle, model.uri, position, token).then((v) => v!);
          }
        : undefined,
    };
  }

  /**
   * 将 IWorkspaceEditDto 转为 monaco-editor 中的 WorkspaceEdit
   */
  private reviveWorkspaceEditDto(data?: IWorkspaceEditDto): modes.WorkspaceEdit {
    if (data && data.edits) {
      for (const edit of data.edits) {
        if (typeof (edit as ResourceTextEditDto).resource === 'object') {
          (edit as ResourceTextEditDto).resource = monaco.Uri.revive((edit as ResourceTextEditDto).resource);
        } else {
          (edit as ResourceFileEditDto).newUri = monaco.Uri.revive((edit as ResourceFileEditDto).newUri);
          (edit as ResourceFileEditDto).oldUri = monaco.Uri.revive((edit as ResourceFileEditDto).oldUri);
        }
      }
    }
    return data as modes.WorkspaceEdit;
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

  protected createSelectionProvider(
    handle: number,
    selector?: LanguageSelector,
  ): monaco.languages.SelectionRangeProvider {
    return {
      provideSelectionRanges: (model, positions, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined;
        }

        if (!this.isLanguageFeatureEnabled(model)) {
          return undefined;
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
        const outgoing = await this.proxy.$provideCallHierarchyOutgoingCalls(
          handle,
          item._sessionId,
          item._itemId,
          token,
        );
        if (!outgoing) {
          return outgoing;
        }
        outgoing.forEach((value) => {
          value.to = this.reviveCallHierarchyItemDto(value.to);
        });
        return outgoing;
      },
      provideIncomingCalls: async (item, token) => {
        const incoming = await this.proxy.$provideCallHierarchyIncomingCalls(
          handle,
          item._sessionId,
          item._itemId,
          token,
        );
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
  // #region Semantic Tokens
  $registerDocumentSemanticTokensProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    legend: SemanticTokensLegend,
  ): void {
    const provider = new DocumentSemanticTokensProvider(this.proxy, handle, legend);
    this.disposables.set(
      handle,
      modes.DocumentSemanticTokensProviderRegistry.register(
        fromLanguageSelector(selector)! as unknown as string,
        provider,
      ),
    );
  }

  $registerDocumentRangeSemanticTokensProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    legend: SemanticTokensLegend,
  ): void {
    const provider = new DocumentRangeSemanticTokensProviderImpl(this.proxy, handle, legend);
    this.disposables.set(
      handle,
      modes.DocumentRangeSemanticTokensProviderRegistry.register(
        fromLanguageSelector(selector)! as unknown as string,
        provider,
      ),
    );
  }
  // #endregion Semantic Tokens

  // #region EvaluatableExpression
  $registerEvaluatableExpressionProvider(handler: number, selector: SerializedDocumentFilter[]): void {
    const provider = {
      provideEvaluatableExpression: (model: ITextModel, position: monaco.Position, token: CancellationToken) =>
        this.proxy.$provideEvaluatableExpression(handler, model.uri, position, token),
    };
    this.disposables.set(
      handler,
      this.evaluatableExpressionService.registerEvaluatableExpressionProvider(selector, provider),
    );
  }
  // #endregion EvaluatableExpression

  // #region Inline Values
  $registerInlineValuesProvider(
    handler: number,
    selector: SerializedDocumentFilter[],
    eventHandle: number | undefined,
  ): void {
    const provider = {
      provideInlineValues: (
        model: ITextModel,
        viewPort: IRange,
        context: InlineValueContext,
        token: CancellationToken,
      ): Promise<InlineValue[] | undefined> =>
        this.proxy.$provideInlineValues(handler, model.uri, viewPort, context, token),
    } as InlineValuesProvider;

    if (typeof eventHandle === 'number') {
      const emitter = new Emitter<void>();
      this.disposables.set(eventHandle, emitter);
      provider.onDidChangeInlineValues = emitter.event;
    }

    this.disposables.set(handler, InlineValuesProviderRegistry.register(selector, provider));
  }

  $emitInlineValuesEvent(eventHandle: number, event?: any): void {
    const obj = this.disposables.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  // #endregion Inline Values

  // #region Linked Editing Range
  $registerLinkedEditingRangeProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector)!;
    modes.LinkedEditingRangeProviderRegistry.register(languageSelector, {
      provideLinkedEditingRanges: async (
        model: ITextModel,
        position: monaco.Position,
        token: CancellationToken,
      ): Promise<modes.LinkedEditingRanges | undefined> => {
        const res = await this.proxy.$provideLinkedEditingRanges(handle, model.uri, position, token);
        if (res) {
          return {
            ranges: res.ranges,
            wordPattern: res.wordPattern ? reviveRegExp(res.wordPattern) : undefined,
          };
        }
        return undefined;
      },
    });
  }

  // #endregion Linked Editing Range

  // #region InlayHints
  $registerInlayHintsProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    eventHandle: number | undefined,
  ): void {
    const provider = {
      provideInlayHints: async (
        model: ITextModel,
        range: monaco.Range,
        token: CancellationToken,
      ): Promise<modes.InlayHint[] | undefined> => {
        const result = await this.proxy.$provideInlayHints(handle, model.uri, range, token);
        return result?.hints;
      },
    } as modes.InlayHintsProvider;

    if (typeof eventHandle === 'number') {
      const emitter = new Emitter<void>();
      this.disposables.set(eventHandle, emitter);
      provider.onDidChangeInlayHints = emitter.event;
    }

    this.disposables.set(handle, modes.InlayHintsProviderRegistry.register(selector, provider));
  }
  $emitInlayHintsEvent(eventHandle: number, event?: any): void {
    const obj = this.disposables.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  // #endregion InlayHints

  // #region LanguageStatus
  private readonly _status = new Map<number, IDisposable>();
  $setLanguageStatus(handle: number, status: ILanguageStatus): void {
    this._status.get(handle)?.dispose();
    this._status.set(handle, this.languageStatusService.addStatus(status));
  }
  $removeLanguageStatus(handle: number): void {
    this._status.get(handle)?.dispose();
  }
  // #endregion LanguageStatus
}
