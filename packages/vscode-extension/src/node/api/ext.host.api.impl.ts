import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService, ExtHostAPIIdentifier } from '../../common';
import { ExtHostCommands } from './extHostCommand';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);
  const extHostCommands = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommands, new ExtHostCommands(rpcProtocol));

  return (extension) => {
    const commands = {
      registerCommand(id: string, command: <T>(...args: any[]) => T | Promise<T>, thisArgs?: any) {
        return extHostCommands.registerCommand(true, id, command, thisArgs);
      },
    };

    return {
      commands,
    };
  };
}
