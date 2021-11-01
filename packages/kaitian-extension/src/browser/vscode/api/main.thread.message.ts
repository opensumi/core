import type vscode from 'vscode';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { IMainThreadMessage, IExtHostMessage, ExtHostAPIIdentifier } from '../../../common/vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { MessageType } from '@ali/ide-core-common';

@Injectable({ multiple: true })
export class MainThreadMessage implements IMainThreadMessage {

  protected readonly proxy: IExtHostMessage;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostMessage);
  }

  public dispose() { }

  async $showMessage(type: MessageType, message: string, options: vscode.MessageOptions, actions: string[], from): Promise<number | undefined> {
    const action = options.modal ? await this.dialogService.open(message, type, actions) : await this.messageService.open(message, type, actions, true, from);
    return action ? actions.indexOf(action) : undefined;
  }

}
