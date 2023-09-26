import clx from 'classnames';
import React from 'react';

import { IAction } from '@opensumi/ide-core-common';
import { isUndefined } from '@opensumi/ide-utils';

import { Button } from '../button';
import { MessageType } from '../common';

import antdNotification, { ArgsProps } from './notification';
import './notification.less';

const DURATION: { [type: number]: number } = {
  [MessageType.Info]: 15,
  [MessageType.Warning]: 18,
  [MessageType.Error]: 20,
};

antdNotification.config({
  placement: 'bottomRight',
});

export const notification = antdNotification;

const cachedArgs: Map<string, [MessageType, ArgsProps]> = new Map();

export function open<T = string>(
  message: string | React.ReactNode,
  type: MessageType,
  closable = true,
  key: string,
  buttons?: Array<string | IAction>,
  description?: string | React.ReactNode,
  duration?: number,
  onClose?: () => void,
): Promise<T | undefined> | undefined {
  return new Promise((resolve) => {
    const args: ArgsProps = {
      key,
      className: clx('kt-notification-wrapper', {
        ['kt-notification-info']: type === MessageType.Info,
        ['kt-notification-error']: type === MessageType.Error,
        ['kt-notification-warn']: type === MessageType.Warning,
      }),
      duration: isUndefined(duration) ? DURATION[type] : duration,
      onClose: () => {
        onClose && onClose();
        cachedArgs.delete(key);
        resolve(undefined);
      },
      btn: buttons
        ? buttons.map((button, index) => {
          const isStringButton = typeof button === 'string';
          const buttonProps = {
            className: `${clx('kt-notification-button')}${isStringButton ? '' : button.class}`,
            ghost: isStringButton ? index === 0 : !button.primary,
            key: isStringButton ? button : button.id,
            onClick: () => {
              resolve(button as any);
                antdNotification.close(key);
                if (!isStringButton) {
                  button.run();
                }
            },
          };
          const text = isStringButton ? button : button.label;
          return (
            <Button size='small' {...buttonProps}>
              {text}
            </Button>
          );
        })
        : null,
      message,
      description,
    };
    cachedArgs.set(key, [type, args]);

    // closable 为 false 时，不展示 closeIcon
    if (!closable) {
      args.closeIcon = <span />;
    }

    doOpenNotification(type, args);
  });
}

export function close(key: string) {
  notification.close(key);
}

export function update(key: string, message: string | React.ReactNode) {
  const args = cachedArgs.get(key)!;
  doOpenNotification(args[0], {
    ...args[1],
    key,
    message,
  });
}

function doOpenNotification(type: MessageType, args: ArgsProps) {
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
}
