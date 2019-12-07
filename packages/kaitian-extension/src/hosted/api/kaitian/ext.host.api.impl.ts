import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionHostService, IExtensionWorkerHost, IExtension, WorkerHostAPIIdentifier } from '../../../common';
import { createLayoutAPIFactory } from './ext.host.layout';
import { createWindowApiFactory } from './ext.host.window';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { ExtensionReporterService } from '../../extension-reporter';
import { Emitter, ReporterProcessMessage, REPORT_HOST } from '@ali/ide-core-common';
import { KaitianExtHostWebview, createKaitianWebviewApi } from './ext.host.webview';

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
  const kaitianExtHostWebview = rpcProtocol.set(ExtHostAPIIdentifier.KaitianExtHostWebview, new KaitianExtHostWebview(rpcProtocol)) as  KaitianExtHostWebview;

  return (extension: IExtension) => {
    const reporter = new ExtensionReporterService(reporterEmitter, {
      extensionId: extension.extensionId,
      extensionVersion: extension.packageJSON.version,
      host: REPORT_HOST.EXTENSION,
    });
    return {
      layout: createLayoutAPIFactory(extHostCommands),
      ideWindow: createWindowApiFactory(extHostCommands),
      webview: createKaitianWebviewApi(extension, kaitianExtHostWebview),
      reporter,
    };
  };
}
