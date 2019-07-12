import { MainThreadAPIIdentifier, IMainThreadCommands } from '../../common';
import { MainThreadCommands } from './mainThreadCommands';
import { Injector } from '@ali/common-di';
import { VSCodeExtensionService } from '../types';
import { IRPCProtocol } from '@ali/ide-connection';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
  extensionService: VSCodeExtensionService,
) {
  rpcProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionServie, extensionService);
  rpcProtocol.set<IMainThreadCommands>(MainThreadAPIIdentifier.MainThreadCommands, injector.get(MainThreadCommands, [rpcProtocol]));
}
