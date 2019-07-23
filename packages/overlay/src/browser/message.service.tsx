import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { IMessageService, AbstractMessageService } from '../common';
import notification, { ArgsProps } from 'antd/lib/notification';
import Button from 'antd/lib/button';
import * as styles from './message.module.less';
import 'antd/lib/notification/style/css';
import { Deferred, MessageType } from '@ali/ide-core-common';

@Injectable()
export class MessageService extends AbstractMessageService implements IMessageService {

  protected deferred: Deferred<any>;

  protected static DURATION: { [type: number]: number } = {
    [MessageType.Info]: 15000,
    [MessageType.Warning]: 18000,
    [MessageType.Error]: 20000,
  };

  constructor() {
    super();
    notification.config({
      placement: 'bottomRight',
    });
  }

  open<T extends string>(message: string, type: MessageType, buttons?: T[]): Promise<T | undefined> {
    this.deferred = new Deferred<T>();
    const args: ArgsProps = {
      className: styles.wrapper,
      duration: MessageService.DURATION[type] / 1000,
      onClose: () => this.hide(),
      btn: buttons ? buttons.map((button) => (<Button onClick={this.handlerClickButton(button)} key={button} className={styles.button} type='primary' size='small'>{button}</Button>)) : null,
      message,
    };

    switch (type) {
      case MessageType.Info:
        notification.info(args);
        break;
      case MessageType.Warning:
        notification.warning(args);
        break;
      case MessageType.Error:
        notification.error(args);
        break;
      default:
        notification.open(args);
        break;
    }
    return this.deferred.promise;
  }

  protected handlerClickButton(value: string) {
    return () => {
      notification.destroy();
      this.hide(value);
    };
  }

  hide(value?: string): void {
    this.deferred.resolve(value);
  }

}
