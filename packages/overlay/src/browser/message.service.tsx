import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { IMessageService, AbstractMessageService } from '../common';
import notification, { ArgsProps } from 'antd/lib/notification';
import 'antd/lib/notification/style/index.css';
import { Button } from '@ali/ide-components';
import { Deferred, MessageType, uuid } from '@ali/ide-core-common';
import clx from 'classnames';

import * as styles from './message.module.less';
@Injectable()
export class MessageService extends AbstractMessageService implements IMessageService {

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

  open<T = string>(message: string | React.ReactNode, type: MessageType, buttons?: string[]): Promise<T | undefined> {
    // 如果两秒内提示信息相同，则直接返回上一个提示
    if (Date.now() - this.showTime < MessageService.SAME_MESSAGE_DURATION && this.preMessage === message) {
      return Promise.resolve(undefined);
    }

    this.preMessage = message;
    this.showTime = Date.now();
    const key = uuid();
    const deferred = new Deferred<T>();
    const args: ArgsProps = {
      key,
      className: clx(styles.wrapper, {
        [styles.info]: type === MessageType.Info,
        [styles.error]: type === MessageType.Error,
        [styles.warning]: type === MessageType.Warning,
      }),
      duration: MessageService.DURATION[type] / 1000,
      onClose: () => deferred.resolve(),
      btn: buttons ? buttons.map((button, index) => (<Button
        className={clx(styles.button)}
        onClick={() => {
          deferred.resolve(button as any);
          notification.close(key);
        }}
        key={button}>{button}</Button>)) : null,
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
    return deferred.promise;
  }

  hide(): void {
    notification.destroy();
  }
}
