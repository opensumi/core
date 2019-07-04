import {IRPCProtocol, ExtensionProcessService, MainThreadAPIIdentifier} from '../../common';
import {MainThreadCommands} from './mainThreadCommands';
import { Injector } from '@ali/common-di';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
  extensionService,
) {
  rpcProtocol.set(MainThreadAPIIdentifier.MainThreadExtensionServie, extensionService);
  rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, injector.get(MainThreadCommands, [rpcProtocol]));
}
