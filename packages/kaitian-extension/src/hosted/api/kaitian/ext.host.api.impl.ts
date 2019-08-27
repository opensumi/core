import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionHostService } from '../../../common';
import { ExtHostCommands } from '../vscode/ext.host.command';
import { createLayoutAPIFactory } from './ext.host.layout';

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService,
) {

  const extHostCommands = new ExtHostCommands(rpcProtocol);

  return () => {
    return {
      layout: createLayoutAPIFactory(extHostCommands),
    };

  };
}
