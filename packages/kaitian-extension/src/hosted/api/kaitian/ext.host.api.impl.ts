import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionHostService, IExtensionWorkerHost, IExtension, WorkerHostAPIIdentifier } from '../../../common';
import { ExtHostCommands } from '../vscode/ext.host.command';
import { createLayoutAPIFactory } from './ext.host.layout';

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService | IExtensionWorkerHost,
  type: string,
) {

  const extHostCommands = new ExtHostCommands(rpcProtocol);
  if (type === 'worker') {
    rpcProtocol.set(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService, extensionService);
  }

  return (extension: IExtension) => {
    return {
      layout: createLayoutAPIFactory(extHostCommands),
    };

  };
}
