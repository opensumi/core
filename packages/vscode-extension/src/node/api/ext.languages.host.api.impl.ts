import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, ExtensionDocumentDataManager } from '../../common';
import { ExtHostLanguages } from './ext.host.language';
import { DocumentSelector, HoverProvider, Disposable } from 'vscode';

export function createLanguagesApiFactory(rpcProtocol: IRPCProtocol, extDoc: ExtensionDocumentDataManager) {

  const extHostLanguages = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extDoc));

  return {
    registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
      return extHostLanguages.registerHoverProvider(selector, provider);
    },
  };
}
