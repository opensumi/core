import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadLanguages } from '../../common';
import { Injectable, Optinal } from '@ali/common-di';
import { DisposableCollection } from '@ali/ide-core-common';
import { SerializedDocumentFilter, LanguageSelector } from '../../common/model.api';
import { fromLanguageSelector } from '../../common/coverter';

@Injectable()
export class MainThreadLanguages implements IMainThreadLanguages {
  private readonly proxy: any;

  constructor( @Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    // this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostLanguages);
  }

  $registerHoverProvider(handle: number, selector: SerializedDocumentFilter[]): void {
    const languageSelector = fromLanguageSelector(selector);
    const hoverProvider = this.createHoverProvider(handle, languageSelector);
    const disposable = new DisposableCollection();
    // for (const language of getLanguages()) {
    //     if (this.matchLanguage(languageSelector, language)) {
    //         disposable.push(monaco.languages.registerHoverProvider(language, hoverProvider));
    //     }
    // }
    disposable.push(monaco.languages.registerHoverProvider('javascript', hoverProvider));
  }

  protected createHoverProvider(handle: number, selector: LanguageSelector | undefined): monaco.languages.HoverProvider {
      return {
          provideHover: (model, position, token) => {
              // if (!this.matchModel(selector, MonacoModelIdentifier.fromModel(model))) {
              //     return undefined!;
              // }
              return this.proxy.$provideHover(handle, model.uri, position, token).then((v) => v!);
          },
      };
  }
}
