import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadLanguages, IExtHostLanguages } from '../../common';
import { Injectable, Optinal } from '@ali/common-di';
import { DisposableCollection, Emitter } from '@ali/ide-core-common';
import { SerializedDocumentFilter, LanguageSelector, DocumentLink, SerializedLanguageConfiguration, ILink, ILinksList } from '../../common/model.api';
import { fromLanguageSelector } from '../../common/converter';
import { DocumentFilter, testGlob, MonacoModelIdentifier } from 'monaco-languageclient';
import { reviveRegExp, reviveIndentationRule, reviveOnEnterRules } from '../../common/utils';
import URI from 'vscode-uri';

@Injectable()
export class MainThreadLanguages implements IMainThreadLanguages {
  private readonly proxy: IExtHostLanguages;
  private readonly disposables = new Map<number, monaco.IDisposable>();

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy<IExtHostLanguages>(ExtHostAPIIdentifier.ExtHostLanguages);
  }

  $unregister(handle) {
    console.log(`unregister ${handle} not implemented!`);
  }

  $getLanguages(): string[] {
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
    const disposable = new DisposableCollection();
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerHoverProvider(language, hoverProvider));
      }
    }
  }

  protected createHoverProvider(handle: number, selector?: LanguageSelector): monaco.languages.HoverProvider {
    return {
      provideHover: (model, position, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideHover(handle, model.uri, position, token).then((v) => v!);
      },
    };
  }

  $registerCompletionSupport(handle: number, selector: SerializedDocumentFilter[], triggerCharacters: string[], supportsResolveDetails: boolean): void {
    // NOTE monaco.languages.registerCompletionItemProvider api显示只能传string，实际内部实现支持DocumentSelector
    this.disposables.set(handle, monaco.languages.registerCompletionItemProvider(fromLanguageSelector(selector)! as any, {
      triggerCharacters,
      provideCompletionItems: async (model: monaco.editor.ITextModel, position: monaco.Position, context, token: monaco.CancellationToken) => {
        const result = await this.proxy.$provideCompletionItems(handle, model.uri, position, context, token);
        if (!result) {
          return undefined!;
        }
        // TODO suggestion.insertText.value，导出的实现需要看下
        return {
          suggestions: result.items,
          incomplete: result.incomplete,
          // tslint:disable-next-line:no-any
          dispose: () => this.proxy.$releaseCompletionItems(handle, (result as any)._id),
        } as monaco.languages.CompletionList;
      },
      resolveCompletionItem: supportsResolveDetails
        // @ts-ignore TODO 这里需要看下
        ? (model, position, suggestion, token) => Promise.resolve(this.proxy.$resolveCompletionItem(handle, model.uri, position, suggestion, token))
        : undefined,
    }));
  }

  protected matchLanguage(selector: LanguageSelector | undefined, languageId: string): boolean {
    if (Array.isArray(selector)) {
      return selector.some((filter) => this.matchLanguage(filter, languageId));
    }

    // TODO 把实现copy出来
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
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDefinitionProvider(language, definitionProvider));
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
        const result = await this.proxy.$provideDefinition(handle, model.uri, position, token);
        if (!result) {
          return undefined!;
        }
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
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerTypeDefinitionProvider(language, typeDefinitionProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createTypeDefinitionProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.TypeDefinitionProvider {
    return {
      provideTypeDefinition: (model, position, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideTypeDefinition(handle, model.uri, position, token).then((result) => {
          if (!result) {
            return undefined!;
          }

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
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerFoldingRangeProvider(language, provider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createFoldingRangeProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.FoldingRangeProvider {
    return {
      provideFoldingRanges: (model, context, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideFoldingRange(handle, model.uri, context, token).then((v) => {
          return v!;
        });
      },
    };
  }

  $registerDocumentColorProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const colorProvider = this.createColorProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerColorProvider(language, colorProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createColorProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentColorProvider {
    return {
      provideDocumentColors: (model, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideDocumentColors(handle, model.uri, token).then((documentColors) =>
          documentColors.map((documentColor) => {
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
          }),
        );
      },
      provideColorPresentations: (model, colorInfo, token) =>
        this.proxy.$provideColorPresentations(handle, model.uri, {
          color: [
            colorInfo.color.red,
            colorInfo.color.green,
            colorInfo.color.blue,
            colorInfo.color.alpha,
          ],
          range: colorInfo.range,
        }, token),
    };
  }

  $registerDocumentHighlightProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const documentHighlightProvider = this.createDocumentHighlightProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDocumentHighlightProvider(language, documentHighlightProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createDocumentHighlightProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentHighlightProvider {
    return {
      provideDocumentHighlights: (model, position, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideDocumentHighlights(handle, model.uri, position, token).then((result) => {
          if (!result) {
            return undefined!;
          }
          if (Array.isArray(result)) {
            const highlights: monaco.languages.DocumentHighlight[] = [];
            for (const item of result) {
              highlights.push(
                {
                  ...item,
                  kind: (item.kind ? item.kind : monaco.languages.DocumentHighlightKind.Text),
                });
            }
            return highlights;
          }

          return undefined!;
        });

      },
    };
  }

  $registerRangeFormattingProvider(handle: number, selector: SerializedDocumentFilter[]) {
    const languageSelector = fromLanguageSelector(selector);
    const documentHighlightProvider = this.createDocumentRangeFormattingEditProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerDocumentRangeFormattingEditProvider(language, documentHighlightProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createDocumentRangeFormattingEditProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.DocumentRangeFormattingEditProvider {
    return {
      provideDocumentRangeFormattingEdits: async (model, range, options) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options).then((result) => {
          if (!result) {
            return undefined;
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
    for (const language of this.$getLanguages()) {
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
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideOnTypeFormattingEdits(handle, model.uri, position, ch, options).then((v) => v!);
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
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerCodeLensProvider(language, lensProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  createCodeLensProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.CodeLensProvider {
    return {
      provideCodeLenses: (model, token) =>
        this.proxy.$provideCodeLenses(handle, model.uri).then((v) => v!)
      ,
      resolveCodeLens: (model, codeLens, token) =>
        this.proxy.$resolveCodeLens(handle, model.uri, codeLens).then((v) => v!),
    };
  }

  // tslint:disable-next-line:no-any
  $emitCodeLensEvent(eventHandle: number, event?: any): void {
    const obj = this.disposables.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }

  $registerDocumentLinkProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const linkProvider = this.createLinkProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerLinkProvider(language, linkProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createLinkProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.LinkProvider {
    return {
      provideLinks: (model, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideDocumentLinks(handle, model.uri, token).then((modelLinks) => {
          if (!modelLinks) {
            return undefined;
          }
          const links = modelLinks.map((link) => this.reviveLink(link));
          return {
            links,
            dispose: () => {
              console.warn('TODO 需要传递handleId实现release');
            },
          };
        });
      },
      resolveLink: (link: monaco.languages.ILink, token) =>
        this.proxy.$resolveDocumentLink(handle, link, token).then((v) => {
          if (!v) {
            return undefined;
          }
          return this.reviveLink(v);
        }),
    };
  }

  reviveLink(data: ILink) {
    if (data.url && typeof data.url !== 'string') {
      data.url = URI.revive(data.url);
    }
    return  data as monaco.languages.ILink;
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
    for (const language of this.$getLanguages()) {
      if (this.matchLanguage(languageSelector, language)) {
        disposable.push(monaco.languages.registerReferenceProvider(language, referenceProvider));
      }
    }
    this.disposables.set(handle, disposable);
  }

  protected createReferenceProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.ReferenceProvider {
    return {
      provideReferences: (model, position, context, token) => {
        if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
          return undefined!;
        }
        return this.proxy.$provideReferences(handle, model.uri, position, context, token).then((result) => {
          if (!result) {
            return undefined!;
          }

          if (Array.isArray(result)) {
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
}
