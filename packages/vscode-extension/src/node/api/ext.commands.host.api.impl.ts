import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier } from '../../common';
import { ExtHostCommands } from './extHostCommand';

export function createCommandsApiFactory(rpcProtocol: IRPCProtocol) {

  const extHostCommands = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommands, new ExtHostCommands(rpcProtocol));

  return {
    registerCommand(id: string, command: <T>(...args: any[]) => T | Promise<T>, thisArgs?: any) {
      return extHostCommands.registerCommand(true, id, command, thisArgs);
    },
  };
}
