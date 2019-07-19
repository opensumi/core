import * as vscode from 'vscode';
import { IDialogService, IMessageService, MessageType } from '@ali/ide-overlay';
import { IMainThreadMessage, IExtHostMessage, MainMessageType, ExtHostAPIIdentifier } from '../../common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';

@Injectable()
export class MainThreadMessage implements IMainThreadMessage {

  protected readonly proxy: IExtHostMessage;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostMessage);
  }

  async $showMessage(type: MainMessageType, message: string, options: vscode.MessageOptions, actions: string[]): Promise<string | undefined> {
    const messageType = type === MainMessageType.Error ? MessageType.Error :
                type === MainMessageType.Warning ? MessageType.Warning :
                    MessageType.Info;
    if (options.modal) {
      return this.dialogService.open(message, messageType, actions);
    } else {
      return this.messageService.open(message, messageType, actions);
    }
  }

}
