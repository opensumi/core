import * as vscode from 'vscode';
import notification from 'antd/lib/notification';
import 'antd/lib/notification/style/css';
import Modal from 'antd/lib/modal';
import 'antd/lib/modal/style/css';
import { IMainThreadMessage, IExtHostMessage, MainMessageType, ExtHostAPIIdentifier } from '../../common';
import { Injectable, Optinal } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
// import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
// import { NOTIFICATIONS_BACKGROUND, NOTIFICATIONS_BORDER, NOTIFICATIONS_FOREGROUND } from '@ali/ide-theme/lib/common/color-registry';
// import { ITheme } from '@ali/ide-theme';

@Injectable()
export class MainThreadMessage implements IMainThreadMessage {

  protected proxy: IExtHostMessage;

  // @Autowired()
  // workbenchThemeService: WorkbenchThemeService;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostMessage);
    notification.config({
      placement: 'bottomRight',
    });
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

  async $showMessage(type: MainMessageType, message: string, options: vscode.MessageOptions, actions: string[]): Promise<number | undefined> {
    const args: any = options.modal ? {
      title: message,
    } : {
      message,
    };
    (global as any).Modal = Modal;
    switch (type) {
      case MainMessageType.Info:
        options.modal ? Modal.info(args) : notification.info(args);
        break;
      case MainMessageType.Warning:
        options.modal ? Modal.warning(args) : notification.warning(args);
        break;
      case MainMessageType.Error:
        options.modal ? Modal.error(args) : notification.error(args);
        break;
      default:
        options.modal ? Modal.confirm(args) : notification.open(args);
        break;
    }
    return 0;
  }

}
