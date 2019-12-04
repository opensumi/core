import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionHostService, IExtensionWorkerHost, IExtension, WorkerHostAPIIdentifier } from '../../../common';
import { createLayoutAPIFactory } from './ext.host.layout';
import { createWindowApiFactory } from './ext.host.window';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { ExtensionReporterService } from '../../extension-reporter';
import { Emitter, ReporterProcessMessage } from '@ali/ide-core-common';

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

  return (extension: IExtension) => {
    const reporter = new ExtensionReporterService(rpcProtocol, reporterEmitter, {
      extensionId: extension.extensionId,
      extensionVersion: extension.packageJSON.version,
    });
    return {
      layout: createLayoutAPIFactory(extHostCommands),
      ideWindow: createWindowApiFactory(extHostCommands),
      reporter,
    };
  };
}
