import { IRPCProtocol } from '@ali/ide-connection';

export function createWindowApiFactory(rpcProtocol: IRPCProtocol) {

  return {
    createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string) {

    },
  };
}
