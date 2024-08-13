import { IRPCProtocol } from '@opensumi/ide-connection';
import { IReporter, REPORT_HOST, ReporterService } from '@opensumi/ide-core-common';

import { IExtensionHostService, IExtensionWorkerHost, WorkerHostAPIIdentifier } from '../../../common';
import { ExtHostSumiAPIIdentifier, ExternalSumiExtApi } from '../../../common/sumi';
import { ExtHostAPIIdentifier, IExtensionDescription } from '../../../common/vscode';
import { ExtensionHostEditorService } from '../vscode/editor/editor.host';

import { ExtHostChatAgents, createChatApiFactory } from './ext.host.chat.impl';
import { createCommandsApiFactory } from './ext.host.command';
import { ExtHostCommon, createEventAPIFactory } from './ext.host.common';
import { ExtHostLayout, createLayoutAPIFactory } from './ext.host.layout';
import { ExtHostLifeCycle, createLifeCycleApi } from './ext.host.lifecycle';
import { ExtHostTheme, createThemeApi } from './ext.host.theme';
import { ExtHostToolbarActionService, createToolbarAPIFactory } from './ext.host.toolbar';
import { ExtHostWebview, createWebviewApi } from './ext.host.webview';
import { ExtHostIDEWindow, createWindowApiFactory } from './ext.host.window';

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService | IExtensionWorkerHost,
  type: string,
  reporterEmitter: IReporter,
  externalSumiExtApi: ExternalSumiExtApi = {},
) {
  if (type === 'worker') {
    rpcProtocol.set(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService, extensionService);
  }

  const extHostCommands = rpcProtocol.get(ExtHostAPIIdentifier.ExtHostCommands);
  const extHostEditors = rpcProtocol.get(ExtHostAPIIdentifier.ExtHostEditors) as ExtensionHostEditorService;
  const extHostWebview = rpcProtocol.set(
    ExtHostAPIIdentifier.SumiExtHostWebview,
    new ExtHostWebview(rpcProtocol),
  ) as ExtHostWebview;
  const extHostLifeCycle = rpcProtocol.set(
    ExtHostSumiAPIIdentifier.ExtHostLifeCycle,
    new ExtHostLifeCycle(rpcProtocol),
  );
  const extHostLayout = rpcProtocol.set(ExtHostSumiAPIIdentifier.ExtHostLayout, new ExtHostLayout(rpcProtocol));
  const extHostTheme = rpcProtocol.set(
    ExtHostSumiAPIIdentifier.ExtHostTheme,
    new ExtHostTheme(rpcProtocol),
  ) as ExtHostTheme;
  const extHostCommon = rpcProtocol.set(
    ExtHostSumiAPIIdentifier.ExtHostCommon,
    new ExtHostCommon(rpcProtocol),
  ) as ExtHostCommon;
  const extHostToolbar = rpcProtocol.set(
    ExtHostSumiAPIIdentifier.ExtHostToolbar,
    new ExtHostToolbarActionService(extHostCommands, extHostCommon, rpcProtocol, extensionService.logger),
  ) as ExtHostToolbarActionService;
  const extHostWindow = rpcProtocol.set(
    ExtHostSumiAPIIdentifier.ExtHostIDEWindow,
    new ExtHostIDEWindow(rpcProtocol),
  ) as ExtHostIDEWindow;
  const extHostChatAgents = rpcProtocol.set(
    ExtHostSumiAPIIdentifier.ExtHostChatAgents,
    new ExtHostChatAgents(rpcProtocol),
  ) as ExtHostChatAgents;

  const externalSumiApis = Object.keys(externalSumiExtApi).reduce((acc, key) => {
    const identifier = externalSumiExtApi[key].identifier;
    const api = externalSumiExtApi[key].createApiFactory(rpcProtocol);
    // register external api rpc protocol
    if (identifier) {
      rpcProtocol.set(identifier, api);
    }
    acc[key] = api;
    return acc;
  }, {});

  return (extension: IExtensionDescription) => {
    const reporter = new ReporterService(reporterEmitter, {
      extensionId: extension.extensionId,
      extensionVersion: extension.packageJSON.version,
      host: type === 'worker' ? REPORT_HOST.WORKER : REPORT_HOST.EXTENSION,
    });
    return {
      layout: createLayoutAPIFactory(extHostCommands, extHostLayout, extension),
      ideWindow: createWindowApiFactory(extHostCommands, extHostWindow),
      webview: createWebviewApi(extension, extHostWebview),
      lifecycle: createLifeCycleApi(extHostCommands, extHostLifeCycle),
      theme: createThemeApi(extHostTheme),
      event: createEventAPIFactory(extHostCommands, extHostCommon, extension),
      reporter,
      commands: createCommandsApiFactory(extHostCommands, extHostEditors, extension),
      toolbar: createToolbarAPIFactory(extension, extHostToolbar),
      chat: createChatApiFactory(extension, extHostChatAgents),
      ...externalSumiApis,
    };
  };
}
