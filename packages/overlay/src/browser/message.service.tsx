import React from 'react';

import { Autowired, Injectable } from '@opensumi/di';
import { notification, open } from '@opensumi/ide-components';
import { parseWithoutEscape } from '@opensumi/ide-components/lib/utils';
import { IOpenerService, toMarkdown } from '@opensumi/ide-core-browser';
import { MayCancelablePromise, MessageType, localize, uuid } from '@opensumi/ide-core-common';

import { AbstractMessageService, IMessageService, MAX_MESSAGE_LENGTH, OpenMessageOptions } from '../common';

@Injectable()
export class MessageService extends AbstractMessageService implements IMessageService {
  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  // 上一个展示的文案
  private preMessage: string | React.ReactNode;

  // 当前组件展示的时间
  private showTime = 0;

  // 相同文案返回的间隔时间
  protected static SAME_MESSAGE_DURATION_MS = 3000;

  // 单位为秒: https://github.com/react-component/notification#notificationnoticeprops
  protected static DURATION: { [type: number]: number } = {
    [MessageType.Info]: 15,
    [MessageType.Warning]: 18,
    [MessageType.Error]: 20,
  };

  /**
   *
   * @param rawMessage message
   * @param type MessageType
   * @param buttons buttons
   * @param closable true | false
   * @param from from extension
   */
  open<T = string>({
    type,
    buttons,
    from,
    closable = true,
    message: rawMessage,
  }: OpenMessageOptions): MayCancelablePromise<T | undefined> {
    if (!rawMessage) {
      return Promise.resolve(undefined);
    }
    let message = rawMessage;
    // 如果两秒内提示信息相同，则直接返回上一个提示
    if (
      Date.now() - this.showTime < MessageService.SAME_MESSAGE_DURATION_MS &&
      typeof message === 'string' &&
      this.preMessage === message
    ) {
      return Promise.resolve(undefined);
    }
    this.preMessage = typeof message === 'string' && message;
    this.showTime = Date.now();
    if (typeof rawMessage === 'string' && rawMessage.length > MAX_MESSAGE_LENGTH) {
      message = `${rawMessage.substr(0, MAX_MESSAGE_LENGTH)}...`;
    }
    const description = from && typeof from === 'string' ? `${localize('component.message.origin')}: ${from}` : '';
    const key = uuid();
    const promise = open<T>(
      toMarkdown(message, this.openerService, { walkTokens: parseWithoutEscape }),
      type,
      closable,
      key,
      buttons,
      description,
      MessageService.DURATION[type],
    );
    return promise || Promise.resolve(undefined);
  }

  hide(): void {
    notification.destroy();
  }
}
