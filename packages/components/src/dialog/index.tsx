import * as React from 'react';
import * as clx from 'classnames';

import { Overlay, IOverlayProps } from '../overlay';
import * as styles from './styles.module.less';
import { IconContext } from '../icon';

export enum MessageType {
  Error,
  Warning,
  Info,
  Empty,
}

export interface IconDesc {
  color: string;
  className: string;
}

export interface IDialogProps extends IOverlayProps {
  type?: MessageType;
  icon?: IconDesc;
  message: string | React.ReactNode;
  buttons: JSX.Element[] | JSX.Element;
  closable?: boolean;
}

export const Dialog: React.FC<IDialogProps> = ({
  visible,
  onClose,
  closable,
  afterClose,
  type,
  icon,
  message,
  buttons,
  title,
}) => {
  const { getIcon } = React.useContext(IconContext);
  return (
    <Overlay
      visible={visible}
      onClose={onClose}
      title={title}
      closable={closable}
      afterClose={afterClose}>
      { type !== MessageType.Empty ? (
        <>
          <div className={styles.content}>
          {icon && <div style={{ color: icon.color }} className={clx(styles.icon, getIcon(icon.className))}/>}
          {typeof message === 'string' ? (<span className={styles.message}>{ message }</span>) : message}
        </div>
        <div className={styles.buttonWrap}>
          {buttons}
        </div>
        </>
      ) :  message}
    </Overlay>
  );
};
