import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionHostService, IExtensionWorkerHost, IExtension, WorkerHostAPIIdentifier } from '../../../common';
import { createLayoutAPIFactory } from './ext.host.layout';
import { ExtHostAPIIdentifier } from '../../../common/vscode';

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService | IExtensionWorkerHost,
  type: string,
) {

  if (type === 'worker') {
    rpcProtocol.set(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService, extensionService);
  }

  const extHostCommands = rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);

  return (extension: IExtension) => {
    return {
      layout: createLayoutAPIFactory(extHostCommands),
    };

  };
}
