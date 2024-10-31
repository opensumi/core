import { Autowired, Injectable } from '@opensumi/di';
import { Deferred, Emitter, MessageType } from '@opensumi/ide-core-common';

import { AbstractMessageService, IDialogService, Icon, OpenMessageOptions } from '../common';

import { DialogContextKey } from './dialog.contextkey';

@Injectable()
export class DialogService extends AbstractMessageService implements IDialogService {
  protected type: MessageType | undefined;

  protected deferred: Deferred<any>;

  @Autowired(DialogContextKey)
  private readonly contextkeyService: DialogContextKey;

  protected _visible = false;

  protected message: string | React.ReactNode = '';

  protected detail: string | undefined;

  protected title = '';

  public closable = true;

  protected buttons: string[] | undefined;

  protected props: Record<string, any> = {};

  private onDidDialogVisibleChangeEmitter = new Emitter<boolean>();

  get onDidDialogVisibleChange() {
    return this.onDidDialogVisibleChangeEmitter.event;
  }

  get visible() {
    return this._visible;
  }

  open<T = string>({
    message,
    type,
    buttons,
    options,
    closable = true,
    props,
  }: OpenMessageOptions): Promise<T | undefined> {
    this.deferred = new Deferred<string>();
    this.type = type;
    this.message = message;
    this.detail = options?.detail;
    this._visible = true;
    this.closable = closable;
    this.props = props ?? {};
    this.buttons = buttons;

    this.onDidDialogVisibleChangeEmitter.fire(this._visible);
    this.contextkeyService.dialogViewVisibleContext.set(true);
    return this.deferred.promise;
  }

  hide<T = string>(value?: T): void {
    this._visible = false;
    this.onDidDialogVisibleChangeEmitter.fire(this._visible);
    this.contextkeyService.dialogViewVisibleContext.set(false);
    this.deferred.resolve(value);
  }

  reset(): void {
    this.type = undefined;
    this.message = '';
    this.buttons = [];
    this.props = {};
  }

  getMessage(): string | React.ReactNode {
    return this.message;
  }

  getDetail(): string | undefined {
    return this.detail;
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

  getButtons() {
    return this.buttons;
  }

  getProps(): Record<string, any> {
    return this.props;
  }
}
