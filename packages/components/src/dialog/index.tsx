import * as React from 'react';
import * as clx from 'classnames';

import { Overlay, IOverlayProps } from '../overlay';
import * as styles from './styles.module.less';
import { IconContext, getDefaultIcon } from '../icon';
import { Button } from '../button';

export enum MessageType {
  Error,
  Warning,
  Info,
  Empty,
}

export type ModalType = 'basic' | 'confirm' | 'info';

export interface IconDesc {
  color: string;
  className: string;
}

export interface IDialogProps extends IOverlayProps {
  messageType?: MessageType;
  type?: ModalType;
  icon?: IconDesc;
  message: string | React.ReactNode;
  buttons: JSX.Element[] | JSX.Element;
  closable?: boolean;
  onOk?: () => void;
  onCancel?: () => void;
  okText?: string;
  cancelText?: string;
}

const DefaultButtons = ({ onCancel, onOk, cancelText, okText }) => (
  <>
    <Button size='large' onClick={onCancel} type='secondary'>{cancelText || '取消'}</Button>
    <Button size='large' onClick={onOk}>{okText || '确定'}</Button>
  </>
);

export const Dialog: React.FC<IDialogProps> = ({
  visible,
  onClose,
  closable,
  afterClose,
  messageType,
  icon,
  message,
  buttons,
  type = 'confirm',
  title,
  onOk,
  onCancel,
  okText,
  cancelText,
}) => {
  const { getIcon } = React.useContext(IconContext);
  return (
    <Overlay
      visible={visible}
      onClose={onClose}
      title={type === 'basic' ? title : null}
      closable={type === 'basic'}
      footer={type === 'basic' ? buttons || <DefaultButtons onCancel={onCancel} onOk={onOk} okText={okText} cancelText={cancelText} /> : undefined}
      afterClose={afterClose}>
      <>
        <div className={styles.content}>
          {icon && <div style={{ color: icon.color }} className={clx(styles.icon, getDefaultIcon(icon.className) || getIcon(icon.className))}/>}
          <div className={styles.content_area}>
            {type !== 'basic' && title && <p className={styles.content_title}>{title}</p>}
            {typeof message === 'string' ? (<span className={styles.message}>{ message }</span>) : message}
          </div>
          {closable && type !== 'basic' && <button className={clx(styles.closex, getDefaultIcon('close'))} onClick={onClose}></button>}
        </div>
        {messageType !== MessageType.Empty && type !== 'basic' && <div className={styles.buttonWrap}>
          {type === 'confirm' ? buttons || <DefaultButtons onCancel={onCancel} onOk={onOk} okText={okText} cancelText={cancelText} /> : <Button size='large' onClick={onClose}>知道了</Button>}
        </div>}
      </>
    </Overlay>
  );
};
