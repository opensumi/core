import { IRPCProtocol } from '@opensumi/ide-connection';
import { IExtensionHostService, IExtensionWorkerHost, WorkerHostAPIIdentifier } from '../../../common';
import { createLayoutAPIFactory, ExtHostLayout } from './ext.host.layout';
import { createWindowApiFactory, ExtHostIDEWindow } from './ext.host.window';
import { ExtHostAPIIdentifier, IExtensionDescription } from '../../../common/vscode';
import { ReporterService, REPORT_HOST, IReporter } from '@opensumi/ide-core-common';
import { ExtHostWebview, createWebviewApi } from './ext.host.webview';
import { ExtHostSumiAPIIdentifier } from '../../../common/sumi';
import { ExtHostLifeCycle, createLifeCycleApi } from './ext.host.lifecycle';
import { ExtHostTheme, createThemeApi } from './ext.host.theme';
import { ExtHostCommon, createEventAPIFactory } from './ext.host.common';
import { createCommandsApiFactory } from './ext.host.command';
import { ExtensionHostEditorService } from '../vscode/editor/editor.host';
import { ExtHostToolbarActionService, createToolbarAPIFactory } from './ext.host.toolbar';

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService | IExtensionWorkerHost,
  type: string,
  reporterEmitter: IReporter,
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
    new ExtHostToolbarActionService(extHostCommands, extHostCommon, rpcProtocol),
  ) as ExtHostToolbarActionService;
  const extHostWindow = rpcProtocol.set(
    ExtHostSumiAPIIdentifier.ExtHostIDEWindow,
    new ExtHostIDEWindow(rpcProtocol),
  ) as ExtHostIDEWindow;

  return (extension: IExtensionDescription) => {
    const reporter = new ReporterService(reporterEmitter, {
      extensionId: extension.extensionId,
      extensionVersion: extension.packageJSON.version,
      host: REPORT_HOST.EXTENSION,
    });
    return {
      layout: createLayoutAPIFactory(extHostCommands, extHostLayout, extension),
      ideWindow: createWindowApiFactory(extHostCommands, extHostWindow),
      webview: createWebviewApi(extension, extHostWebview),
      lifecycle: createLifeCycleApi(extHostCommands, extHostLifeCycle),
      theme: createThemeApi(extHostTheme),
      event: createEventAPIFactory(extHostCommands, extHostCommon),
      reporter,
      commands: createCommandsApiFactory(extHostCommands, extHostEditors, extension),
      toolbar: createToolbarAPIFactory(extension, extHostToolbar),
    };
  };
}
