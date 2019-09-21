import { Injectable } from '@ali/common-di';
import { IDialogService, AbstractMessageService } from '../common';
import { observable, action } from 'mobx';
import { Deferred, MessageType } from '@ali/ide-core-common';

@Injectable()
export class DialogService extends AbstractMessageService implements IDialogService {

  protected type: MessageType | undefined;

  protected deferred: Deferred<any>;

  @observable
  protected visible: boolean = false;

  @observable
  protected message: string | React.ReactNode = '';

  @observable
  protected title: string = '';

  @observable
  protected buttons: string[] = [];

  @action
  open(message: string | React.ReactNode, type: MessageType, buttons?: any[]): Promise<string | undefined> {
    this.deferred = new Deferred<string>();
    this.type = type;
    this.message = message;
    this.visible = true;
    if (buttons) {
      this.buttons = buttons;
    }
    return this.deferred.promise;
  }

  @action
  hide(value?: string): void {
    this.visible = false;
    this.deferred.resolve(value);
  }

  @action
  reset(): void {
    this.type = undefined;
    this.message = '';
    this.buttons = [];
  }

  isVisible(): boolean {
    return this.visible;
  }

  getMessage(): string | React.ReactNode {
    return this.message;
  }

  getIcon(): string | undefined {
    switch (this.type) {
      case MessageType.Info:
        return 'info-circle';
      case MessageType.Warning:
        return 'warning-circle';
      case MessageType.Warning:
        return 'close-circle';
      default:
        break;
    }
  }

  getButtons(): string[] {
    return this.buttons;
  }
}
