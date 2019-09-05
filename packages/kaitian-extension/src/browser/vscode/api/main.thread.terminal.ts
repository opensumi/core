import * as vscode from 'vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadTerminal, IExtHostTerminal, ExtHostAPIIdentifier } from '../../../common/vscode';

@Injectable()
export class MainThreadTerminal implements IMainThreadTerminal {
  private readonly proxy: IExtHostTerminal;
  todo: false;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTerminal);
  }
}
