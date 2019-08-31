import * as React from 'react';
import Modal from 'antd/lib/modal';
import 'antd/lib/modal/style/index.css';
import Icon from 'antd/lib/icon';
import Button from 'antd/lib/button';
import 'antd/lib/button/style/index.css';
import { observer } from 'mobx-react-lite';
import * as styles from './dialog.module.less';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { IDialogService } from '../common';

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
      <div>
        {icon && <Icon type={icon} theme='twoTone' />}
        <span className={styles.message}>{ message }</span>
      </div>
      <div className={styles.buttonWrap}>
        {buttons.length ? buttons.map((button, index) => (
          <Button onClick={handlerClickButton(button)} className={styles.button} key={button} type={index === buttons.length - 1 ? 'primary' : 'default'} size='small'>{ button }</Button>
        )) : (
          <Button onClick={handleClose} type='primary' size='small'>{CONFIRM}</Button>
        )}
      </div>
    </Modal>
  );
});
