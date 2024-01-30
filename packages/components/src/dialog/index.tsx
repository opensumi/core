import cls from 'classnames';
import React from 'react';

import { Button } from '../button';
import { MessageType } from '../common';
import { IconContext, getIcon } from '../icon';
import { IOverlayProps, Overlay } from '../overlay';
import './styles.less';

export type ModalType = 'basic' | 'confirm' | 'info';

export interface IconDesc {
  color: string;
  className: string;
}

declare type getContainerFunc = () => HTMLElement;

export interface IDialogProps extends IOverlayProps {
  messageType?: MessageType;
  type?: ModalType;
  icon?: IconDesc;
  message: string | React.ReactNode;
  buttons?: JSX.Element[] | JSX.Element;
  closable?: boolean;
  onOk?: () => void;
  onCancel?: () => void;
  okText?: string;
  cancelText?: string;
  getContainer?: string | HTMLElement | getContainerFunc | false | null;
  keyboard?: boolean;
}

export interface IDialogContentProps {
  icon?: IconDesc;
  type?: ModalType;
}

const DefaultButtons = ({ onCancel, onOk, cancelText, okText }) => (
  <>
    <Button size='large' onClick={onCancel} type='secondary'>
      {cancelText || '取消'}
    </Button>
    <Button size='large' onClick={onOk}>
      {okText || '确定'}
    </Button>
  </>
);

export const DialogContent: React.FC<IDialogProps> = ({
  onClose,
  closable,
  messageType = MessageType.Info,
  icon,
  message,
  buttons,
  type = 'confirm',
  title,
  onOk,
  onCancel,
  okText,
  cancelText,
  ...restProps
}) => {
  const { getIcon: getContextIcon } = React.useContext(IconContext);

  return (
    <>
      <div className={'kt-dialog-content'}>
        {icon && (
          <div
            style={{ color: icon.color }}
            className={cls('kt-dialog-icon', getIcon(icon.className) || getContextIcon(icon.className))}
          />
        )}
        <div className={'kt-dialog-content_area'}>
          {type !== 'basic' && title && <p className={'kt-dialog-content_title'}>{title}</p>}
          <span className={'kt-dialog-message'}>{message}</span>
        </div>
        {closable && type !== 'basic' && (
          <button className={cls('kt-dialog-closex', getIcon('close'))} onClick={onClose}></button>
        )}
      </div>
      {messageType !== MessageType.Empty && type !== 'basic' && (
        <div className={'kt-dialog-buttonWrap'}>
          {type === 'confirm' ? (
            buttons || <DefaultButtons onCancel={onCancel} onOk={onOk} okText={okText} cancelText={cancelText} />
          ) : (
            <Button size='large' onClick={onClose}>
              OK
            </Button>
          )}
        </div>
      )}
    </>
  );
};

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
  getContainer,
  keyboard,
  ...restProps
}) => (
  <Overlay
    visible={visible}
    onClose={onClose}
    title={type === 'basic' ? title : null}
    closable={type === 'basic'}
    getContainer={getContainer}
    keyboard={keyboard}
    footer={
      type === 'basic'
        ? buttons || <DefaultButtons onCancel={onCancel} onOk={onOk} okText={okText} cancelText={cancelText} />
        : undefined
    }
    afterClose={afterClose}
    {...restProps}
  >
    <DialogContent message={message} buttons={buttons} visible={visible} {...restProps}></DialogContent>
  </Overlay>
);
