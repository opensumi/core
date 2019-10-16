import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { IMessageService, AbstractMessageService } from '../common';
import notification, { ArgsProps } from 'antd/lib/notification';
import 'antd/lib/notification/style/index.css';
import { Button } from '@ali/ide-core-browser/lib/components';
import { Deferred, MessageType } from '@ali/ide-core-common';
import clx from 'classnames';

import * as styles from './message.module.less';
@Injectable()
export class MessageService extends AbstractMessageService implements IMessageService {

  protected deferred: Deferred<any> | null;

  // 上一个展示的文案
  private preMessage: string | React.ReactNode;

  // 当前组件展示的时间
  private showTime: number = 0;

  // 相同文案返回的间隔时间
  protected static SAME_MESSAGE_DURATION = 3000;

  // 参考 vscode message 组件消失的时间
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

  open(message: string | React.ReactNode, type: MessageType, buttons?: string[]): Promise<string | undefined> {
    // 如果两秒内提示信息相同，则直接返回上一个提示
    if (Date.now() - this.showTime < MessageService.SAME_MESSAGE_DURATION && this.preMessage === message && this.deferred) {
      return this.deferred.promise;
    }
    // 永远只出现一个 message 组件
    if (this.deferred) {
      notification.destroy();
      this.hide();
    }
    this.preMessage = message;
    this.showTime = Date.now();
    this.deferred = new Deferred<string>();
    const args: ArgsProps = {
      className: clx(styles.wrapper, {
        [styles.info]: type === MessageType.Info,
        [styles.error]: type === MessageType.Error,
        [styles.warning]: type === MessageType.Warning,
      }),
      duration: MessageService.DURATION[type] / 1000,
      onClose: () => this.hide(),
      btn: buttons ? buttons.map((button, index) => (<Button className={clx(styles.button)} onClick={this.handlerClickButton(button)} key={button}>{button}</Button>)) : null,
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

  protected handlerClickButton(value?: string) {
    return () => {
      notification.destroy();
      this.hide(value);
    };
  }

  hide(value?: string): void {
    if (this.deferred) {
      this.deferred.resolve(value);
      this.deferred = null;
    }
  }
}
