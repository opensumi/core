import * as React from 'react';
import Modal from 'antd/lib/modal';
import 'antd/lib/modal/style/index.css';
import Button from 'antd/lib/button';
import 'antd/lib/button/style/index.css';
import { observer } from 'mobx-react-lite';
import * as styles from './dialog.module.less';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { IDialogService } from '../common';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import clx from 'classnames';

const CONFIRM = localize('dialog.confirm');

export const Dialog = observer(() => {
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const icon = dialogService.getIcon();
  const message = dialogService.getMessage();
  const buttons = dialogService.getButtons();

  function afterClose() {
    dialogService.reset();
  }

  function handleClose() {
    dialogService.hide();
  }

  function handlerClickButton(value: string) {
    return () => {
      dialogService.hide(value);
    };
  }

  return (
    <Modal
      visible={dialogService.isVisible()}
      footer={null}
      maskClosable={false}
      onCancel={handleClose}
      afterClose={afterClose}
      className={styles.wrapper}
    >
      <div className={styles.content}>
        {icon && <div style={{ color: icon.color }} className={clx(styles.icon, getIcon(icon.className))}/>}
        {typeof message === 'string' ? (<span className={styles.message}>{ message }</span>) : message}
      </div>
      <div className={styles.buttonWrap}>
        {buttons.length ? buttons.map((button, index) => (
          <div onClick={handlerClickButton(button)} key={button} className={clx(styles.button, {
            [styles.primary]: index === buttons.length - 1,
          })}>{ button }</div>
        )) : (
          <div onClick={handleClose} className={clx(styles.button, styles.primary)}>{CONFIRM}</div>
        )}
      </div>
    </Modal>
  );
});
