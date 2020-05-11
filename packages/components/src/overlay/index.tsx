import * as React from 'react';
import * as clsx from 'classnames';
import Modal, { ModalProps } from 'antd/lib/modal';

import 'antd/lib/modal/style/index.css';

import './styles.less';

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
}

export const Overlay: React.FC<IOverlayProps> = (({ maskClosable = false, closable = true, className, onClose, children, footer, title, ...restProps }) => {
  return (
    <Modal
      footer={footer ? footer : null}
      maskClosable={maskClosable}
      closable={closable}
      onCancel={onClose}
      title={title}
      className={clsx('kt-overlay', className)}
      {...restProps}
    >
      {children}
    </Modal>
  );
});
