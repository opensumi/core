import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService, ExtHostAPIIdentifier } from '../../common';
import { createCommandsApiFactory } from './ext.commands.host.api.impl';
import { createWindowApiFactory } from './ext.window.host.api.impl';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);

  return (extension) => {
    return {
      commands: createCommandsApiFactory(rpcProtocol),
      window: createWindowApiFactory(rpcProtocol),
    };
  };
}
