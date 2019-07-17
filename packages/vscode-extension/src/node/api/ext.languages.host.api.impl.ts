import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, ExtensionDocumentDataManager } from '../../common';
import { ExtHostLanguages } from './ext.host.language';
import { DocumentSelector, HoverProvider, Disposable, CompletionItemProvider } from 'vscode';

export function createLanguagesApiFactory(rpcProtocol: IRPCProtocol, extDoc: ExtensionDocumentDataManager) {

  const extHostLanguages = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extDoc));

  return {
    registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
      return extHostLanguages.registerHoverProvider(selector, provider);
    },
    registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, triggerCharacters: string[]): Disposable {
      return extHostLanguages.registerCompletionItemProvider(selector, provider, triggerCharacters);
    },
  };
}
