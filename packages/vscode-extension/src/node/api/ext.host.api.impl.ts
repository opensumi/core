import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService, ExtHostAPIIdentifier } from '../../common';
import { createWindowApiFactory } from './ext.window.host.api.impl';
import { createDocumentModelApiFactory } from './ext.doc.host.api.impl';
import { createLanguagesApiFactory } from './ext.languages.host.api.impl';
import { ExtensionDocumentDataManagerImpl } from '../doc';
import { Hover, Uri } from '../../common/ext-types';
import { ExtHostCommandsRegistry, createCommandsApiFactory } from './ext.host.command';
import { createWorkspaceApiFactory, ExtHostWorkspace } from './ext.host.workspace';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {
  const extHostDocs = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocol));
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);

  createDocumentModelApiFactory(rpcProtocol);
  const extHostCommandsRegistry = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommandsRegistry, new ExtHostCommandsRegistry(rpcProtocol));
  const extHostWorkspace = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWorkspace, new ExtHostWorkspace(rpcProtocol)) as ExtHostWorkspace;

  return (extension) => {
    return {
      commands: createCommandsApiFactory(extHostCommandsRegistry),
      window: createWindowApiFactory(rpcProtocol),
      languages: createLanguagesApiFactory(rpcProtocol, extHostDocs),
      workspace: createWorkspaceApiFactory(extHostWorkspace),
      env: {},
      version: require('../../../package-lock.json').version,
      comment: {},
      languageServer: {},
      extensions: {},
      debug: {},
      tasks: {},
      scm: {},
      // 类型定义
      Hover,
      Uri,
    };
  };
}
