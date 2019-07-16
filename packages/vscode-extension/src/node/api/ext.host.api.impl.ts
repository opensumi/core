import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService, ExtHostAPIIdentifier } from '../../common';
import { createCommandsApiFactory } from './ext.commands.host.api.impl';
import { createWindowApiFactory } from './ext.window.host.api.impl';
import { createDocumentModelApiFactory } from './ext.doc.host.api.impl';
import { DocumentSelector, HoverProvider, Disposable } from 'vscode';
import { createLanguagesApiFactory } from './ext.languages.host.api.impl';
import { ExtensionDocumentDataManagerImpl } from '../doc';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {
  const extHostDocs = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocol));
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);

  createDocumentModelApiFactory(rpcProtocol);

  return (extension) => {
    return {
      commands: createCommandsApiFactory(rpcProtocol),
      window: createWindowApiFactory(rpcProtocol),
      languages: createLanguagesApiFactory(rpcProtocol, extHostDocs),
    };
  };
}
