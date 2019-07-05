import { IRPCProtocol, ExtHostAPIIdentifier } from '../../common';
import { Injectable, Autowired, Inject, Optinal } from '@ali/common-di';
import { CommandRegistry, getLogger } from '@ali/ide-core-browser';

@Injectable()
export class MainThreadCommands {
  private readonly proxy: any;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  constructor( @Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    // this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
  }

  $registerCommand(id: string): void {
    console.log('$registerCommand id', id);
    const proxy = this.proxy;
    this.commandRegistry.registerCommand({
        id: id + ':extHost',
        label: 'testExtProtocol',
      }, {
        execute: (...args) => {
          return proxy.$executeContributedCommand(id, ...args);
        },
      });
  }
}
