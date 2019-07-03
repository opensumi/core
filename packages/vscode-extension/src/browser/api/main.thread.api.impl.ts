import {IRPCProtocol, ExtensionProcessService, MainThreadAPIIdentifier} from '../../common';
import {MainThreadCommands} from './mainThreadCommands';
import { Injector } from '@ali/common-di';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
) {
  rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, injector.get(MainThreadCommands, [rpcProtocol]));
}
