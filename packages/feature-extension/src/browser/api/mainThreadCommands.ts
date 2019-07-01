import { IRPCProtocol, ExtHostAPIIdentifier } from '../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, getLogger } from '@ali/ide-core-browser';

export class MainThreadCommands {
  private readonly _proxy: any;
  private readonly rpcProtocol: IRPCProtocol;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this._proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
  }

  $registerCommand(id: string): void {
      this.commandRegistry.registerCommand({
        id,
      }, {
        execute: (...args) => {
          return this._proxy.$executeContributedCommand(id, ...args);
        },
      });
  }
}
