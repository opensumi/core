import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionHostService, IExtensionWorkerHost, IExtension, WorkerHostAPIIdentifier } from '../../../common';
import { createLayoutAPIFactory, KaitianExtHostLayout } from './ext.host.layout';
import { createWindowApiFactory } from './ext.host.window';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { ExtensionReporterService } from '../../extension-reporter';
import { Emitter, ReporterProcessMessage, REPORT_HOST } from '@ali/ide-core-common';
import { KaitianExtHostWebview, createKaitianWebviewApi } from './ext.host.webview';
import { ExtHostKaitianAPIIdentifier } from '../../../common/kaitian';
import { ExtHostLifeCycle, createLifeCycleApi } from './ext.host.lifecycle';
import { ExtHostTheme, createThemeApi } from './ext.host.theme';
import { ExtHostCommon, createEventAPIFactory } from './ext.host.common';
import { createCommandsApiFactory } from './ext.host.command';
import { ExtensionHostEditorService } from '../vscode/editor/editor.host';

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService | IExtensionWorkerHost,
  type: string,
  reporterEmitter: Emitter<ReporterProcessMessage>,
) {

  if (type === 'worker') {
    rpcProtocol.set(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService, extensionService);
  }

  const extHostCommands = rpcProtocol.get(ExtHostAPIIdentifier.ExtHostCommands);
  const extHostEditors = rpcProtocol.get(ExtHostAPIIdentifier.ExtHostEditors) as ExtensionHostEditorService;
  const kaitianExtHostWebview = rpcProtocol.set(ExtHostAPIIdentifier.KaitianExtHostWebview, new KaitianExtHostWebview(rpcProtocol)) as  KaitianExtHostWebview;
  const kaitianLifeCycle = rpcProtocol.set(ExtHostKaitianAPIIdentifier.ExtHostLifeCycle, new ExtHostLifeCycle(rpcProtocol));
  const kaitianLayout = rpcProtocol.set(ExtHostKaitianAPIIdentifier.ExtHostLayout, new KaitianExtHostLayout(rpcProtocol));
  const kaitianExtHostTheme = rpcProtocol.set(ExtHostKaitianAPIIdentifier.ExtHostTheme, new ExtHostTheme(rpcProtocol)) as  ExtHostTheme;
  const kaitianExtHostCommon = rpcProtocol.set(ExtHostKaitianAPIIdentifier.ExtHostCommon, new ExtHostCommon(rpcProtocol)) as ExtHostCommon;

  return (extension: IExtension) => {
    const reporter = new ExtensionReporterService(reporterEmitter, {
      extensionId: extension.extensionId,
      extensionVersion: extension.packageJSON.version,
      host: REPORT_HOST.EXTENSION,
    });
    return {
      layout: createLayoutAPIFactory(extHostCommands, kaitianLayout, extension),
      ideWindow: createWindowApiFactory(extHostCommands),
      webview: createKaitianWebviewApi(extension, kaitianExtHostWebview),
      lifecycle: createLifeCycleApi(extHostCommands, kaitianLifeCycle),
      theme: createThemeApi(kaitianExtHostTheme),
      event: createEventAPIFactory(extHostCommands, kaitianExtHostCommon, extension),
      reporter,
      commands: createCommandsApiFactory(extHostCommands, extHostEditors, extension),
    };
  };
}
