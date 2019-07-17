import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService, ExtHostAPIIdentifier } from '../../common';
import { ExtHostMessage, createWindowApiFactory } from './ext.host.window.api.impl';
import { createDocumentModelApiFactory } from './ext.doc.host.api.impl';
import { createLanguagesApiFactory } from './ext.languages.host.api.impl';
import { ExtensionDocumentDataManagerImpl } from '../doc';
import { Hover } from '../../common/ext-types';
import { ExtHostCommands, createCommandsApiFactory } from './ext.host.command';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {
  const extHostDocs = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocol));
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);

  createDocumentModelApiFactory(rpcProtocol);
  const extHostCommands = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommands, new ExtHostCommands(rpcProtocol));

  return (extension) => {
    return {
      commands: createCommandsApiFactory(extHostCommands),
      window: createWindowApiFactory(rpcProtocol),
      languages: createLanguagesApiFactory(rpcProtocol, extHostDocs),
      Hover,
    };
  };
}
