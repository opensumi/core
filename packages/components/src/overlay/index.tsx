import clsx from 'classnames';
import React, { PropsWithChildren } from 'react';

import { Modal, ModalProps } from '../modal';

import './styles.less';

declare type getContainerFunc = () => HTMLElement;

export interface IOverlayProps {
  className?: string;
  width?: number;
  maskClosable?: boolean;
  visible: boolean;
  afterClose: ModalProps['afterClose'];
  onClose: ModalProps['onCancel'];
  closable?: ModalProps['closable'];
  title?: ModalProps['title'];
  footer?: JSX.Element[] | JSX.Element;
  getContainer?: string | HTMLElement | getContainerFunc | false | null;
  keyboard?: boolean;
}

export const Overlay: React.FC<PropsWithChildren<IOverlayProps>> = ({
  maskClosable = false,
  closable = true,
  className,
  onClose,
  children,
  footer,
  title,
  getContainer,
  keyboard,
  ...restProps
}) => (
  <Modal
    footer={footer ? footer : null}
    maskClosable={maskClosable}
    closable={closable}
    onCancel={onClose}
    title={title}
    getContainer={getContainer}
    className={clsx('kt-overlay', className)}
    keyboard={keyboard}
    {...restProps}
  >
    {children}
  </Modal>
);
