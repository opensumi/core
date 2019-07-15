import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadCommands, IExtHostCommands } from '../../common';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { CommandRegistry, ILogger } from '@ali/ide-core-browser';

@Injectable()
export class MainThreadCommands implements IMainThreadCommands {

  private readonly proxy: IExtHostCommands;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(ILogger)
  logger: ILogger;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
  }

  $registerCommand(id: string): void {
    this.logger.log('$registerCommand id', id);
    const proxy = this.proxy;
    this.commandRegistry.registerCommand({
      id: id + ':extHost',
    }, {
        execute: (...args) => {
          return proxy.$executeContributedCommand(id, ...args);
        },
      });
  }

  $unregisterCommand(id: string): void {
    throw new Error('Method not implemented.');
  }
}
