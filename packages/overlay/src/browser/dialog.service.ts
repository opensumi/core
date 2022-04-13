import { observable, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { Deferred, MessageType } from '@opensumi/ide-core-common';

import { IDialogService, AbstractMessageService, Icon } from '../common';

import { DialogContextKey } from './dialog.contextkey';

@Injectable()
export class DialogService extends AbstractMessageService implements IDialogService {
  protected type: MessageType | undefined;

  protected deferred: Deferred<any>;

  @Autowired(DialogContextKey)
  private readonly contextkeyService: DialogContextKey;

  @observable
  protected visible = false;

  @observable
  protected message: string | React.ReactNode = '';

  @observable
  protected title = '';

  @observable
  public closable = true;

  @observable
  protected buttons: string[] = [];

  @action
  open<T = string>(
    message: string | React.ReactNode,
    type: MessageType,
    buttons?: any[],
    closable = true,
  ): Promise<T | undefined> {
    this.deferred = new Deferred<string>();
    this.type = type;
    this.message = message;
    this.visible = true;
    this.contextkeyService.dialogViewVisibleContext.set(true);
    this.closable = closable;
    if (buttons) {
      this.buttons = buttons;
    }
    return this.deferred.promise;
  }

  @action
  hide<T = string>(value?: T): void {
    this.visible = false;
    this.contextkeyService.dialogViewVisibleContext.set(false);
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
