import { Injectable } from '@ide-framework/common-di';
import { IDialogService, AbstractMessageService, Icon} from '../common';
import { observable, action } from 'mobx';
import { Deferred, MessageType } from '@ide-framework/ide-core-common';

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
  public closable: boolean = true;

  @observable
  protected buttons: string[] = [];

  @action
  open<T = string>(message: string | React.ReactNode, type: MessageType, buttons?: any[], closable: boolean = true): Promise<T | undefined> {
    this.deferred = new Deferred<string>();
    this.type = type;
    this.message = message;
    this.visible = true;
    this.closable = closable;
    if (buttons) {
      this.buttons = buttons;
    }
    return this.deferred.promise;
  }

  @action
  hide<T = string>(value?: T): void {
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

  getType(): MessageType | undefined {
    return this.type;
  }

  getIcon(): Icon | undefined {
    switch (this.type) {
      case MessageType.Error:
        return {
          color: 'var(--notificationsErrorIcon-foreground)',
          className: 'close-circle',
        };
      case MessageType.Info:
          return {
            color: 'var(--notificationsInfoIcon-foreground)',
            className: 'info-circle',
          };
      case MessageType.Warning:
          return {
            color: 'var(--notificationsWarningIcon-foreground)',
            className: 'question-circle',
          };
      default:
        break;
    }
  }

  getButtons(): string[] {
    return this.buttons;
  }
}
