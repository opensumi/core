import { IRPCProtocol, ExtHostAPIIdentifier } from '../../common';
import { Injectable, Autowired, Inject } from '@ali/common-di';
import { CommandRegistry, getLogger } from '@ali/ide-core-browser';

@Injectable({multiple: true})
export class MainThreadCommands {
  // private readonly _proxy: any;
  // private readonly rpcProtocol: IRPCProtocol;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  constructor(private rpcProtocol: IRPCProtocol) {
    // this.rpcProtocol = rpcProtocol;

  }

  $registerCommand(id: string): void {
    const _proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
    console.log('$registerCommand id', id);
    this.commandRegistry.registerCommand({
        id,
        label: 'testExtProtocol',
      }, {
        execute: (...args) => {
          return _proxy.$executeContributedCommand(id, ...args);
        },
      });
  }
}
