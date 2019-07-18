import * as vscode from 'vscode';
import { IDialogService, IMessageService, MessageType } from '@ali/ide-overlay';
import { IMainThreadMessage, IExtHostMessage, MainMessageType, ExtHostAPIIdentifier } from '../../common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
// import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
// import { NOTIFICATIONS_BACKGROUND, NOTIFICATIONS_BORDER, NOTIFICATIONS_FOREGROUND } from '@ali/ide-theme/lib/common/color-registry';
// import { ITheme } from '@ali/ide-theme';

@Injectable()
export class MainThreadMessage implements IMainThreadMessage {

  protected proxy: IExtHostMessage;

  // @Autowired()
  // workbenchThemeService: WorkbenchThemeService;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostMessage);
  }

  // protected getColor(theme: ITheme, key: string): string {
  //   const color = theme.getColor(key);
  //   return color ? color.toString() : '#fff';
  // }

  // protected async getStyle() {
  //   const theme: ITheme = await this.workbenchThemeService.getCurrentTheme();

  //   return {
  //     backgroundColor: this.getColor(theme, NOTIFICATIONS_BACKGROUND),
  //     borderColor: this.getColor(theme, NOTIFICATIONS_BORDER),
  //   };
  // }

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
