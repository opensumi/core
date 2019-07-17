import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadLanguages } from '../../common';
import { Injectable, Optinal } from '@ali/common-di';
import { DisposableCollection } from '@ali/ide-core-common';
import { SerializedDocumentFilter, LanguageSelector } from '../../common/model.api';
import { fromLanguageSelector } from '../../common/coverter';
import { DocumentFilter, testGlob, MonacoModelIdentifier } from 'monaco-languageclient';

@Injectable()
export class MainThreadLanguages implements IMainThreadLanguages {
  private readonly proxy: any;
  private readonly disposables = new Map<number, monaco.IDisposable>();

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    // this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostLanguages);
  }

  $getLanguages(): string[] {
    return monaco.languages.getLanguages().map((l) => l.id);
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
    disposable.push(monaco.languages.registerHoverProvider('javascript', hoverProvider));
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
    this.disposables.set(handle, monaco.languages.registerCompletionItemProvider(fromLanguageSelector(selector) as any, {
      triggerCharacters,
      provideCompletionItems: (model: monaco.editor.ITextModel,
                               position: monaco.Position,
                               context,
                               token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.CompletionList> => {
        return Promise.resolve(this.proxy.$provideCompletionItems(handle, model.uri, position, context, token)).then((result) => {
          if (!result) {
            return undefined!;
          }
          return {
            suggestions: result.items,
            incomplete: result.incomplete,
            // tslint:disable-next-line:no-any
            dispose: () => this.proxy.$releaseCompletionItems(handle, (result as any)._id),
          };
        });
      },
      resolveCompletionItem: supportsResolveDetails
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
}
