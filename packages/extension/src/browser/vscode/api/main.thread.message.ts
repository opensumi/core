import type vscode from 'vscode';

import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { MessageType } from '@opensumi/ide-core-common';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';

import { IMainThreadMessage, IExtHostMessage, ExtHostAPIIdentifier } from '../../../common/vscode';

@Injectable({ multiple: true })
export class MainThreadMessage implements IMainThreadMessage {
  protected readonly proxy: IExtHostMessage;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostMessage);
  }

  public dispose() {}

  async $showMessage(
    type: MessageType,
    message: string,
    options: vscode.MessageOptions,
    actions: string[],
    from,
  ): Promise<number | undefined> {
    const action = options.modal
      ? await this.dialogService.open(message, type, actions)
      : await this.messageService.open(message, type, actions, true, from);
    return action ? actions.indexOf(action) : undefined;
  }
}
