import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService, ExtHostAPIIdentifier } from '../../common';
import { ExtHostMessage, createWindowApiFactory } from './ext.host.window.api.impl';
import { createDocumentModelApiFactory } from './ext.doc.host.api.impl';
import { createLanguagesApiFactory } from './ext.languages.host.api.impl';
import { ExtensionDocumentDataManagerImpl } from '../doc';
import { Hover, Uri, IndentAction, CodeLens, Disposable } from '../../common/ext-types';
import {CancellationTokenSource, Emitter} from '@ali/ide-core-common';
import { ExtHostCommands, createCommandsApiFactory } from './ext.host.command';
import { ExtHostWorkspace, createWorkspaceApiFactory } from './ext.host.workspace';
import { ExtHostPreference } from './ext.host.preference';
import { createExtensionsApiFactory } from './ext.host.extensions';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {
  const extHostDocs = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocol));
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);

  createDocumentModelApiFactory(rpcProtocol);
  const extHostCommands = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommands, new ExtHostCommands(rpcProtocol));
  const extHostMessage = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocol));
  const extHostWorkspace = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWorkspace, new ExtHostWorkspace(rpcProtocol)) as ExtHostWorkspace;
  const extHostPreference = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostPreference, new ExtHostPreference(rpcProtocol, extHostWorkspace)) as ExtHostPreference;

  return (extension) => {
    return {
      commands: createCommandsApiFactory(extHostCommands),
      window: createWindowApiFactory(rpcProtocol),
      languages: createLanguagesApiFactory(rpcProtocol, extHostDocs),
      workspace: createWorkspaceApiFactory(extHostWorkspace, extHostPreference),
      env: {},
      // version: require('../../../package-lock.json').version,
      comment: {},
      languageServer: {},
      extensions: createExtensionsApiFactory(rpcProtocol, extensionService),
      debug: {},
      tasks: {},
      scm: {},
      // 类型定义
      Hover,
      Uri,
      CancellationTokenSource,
      IndentAction,
      CodeLens,
      Disposable,
      EventEmitter: Emitter,
    };
  };
}
