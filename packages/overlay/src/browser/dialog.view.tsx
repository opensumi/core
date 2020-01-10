import * as React from 'react';
import 'antd/lib/button/style/index.css';
import { observer } from 'mobx-react-lite';
import * as styles from './dialog.module.less';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { IDialogService } from '../common';
import { mnemonicButtonLabel } from '@ali/ide-core-common/lib/utils/strings';
import { Button, Dialog as DialogView } from '@ali/ide-components';

export const Dialog = observer(() => {
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const icon = dialogService.getIcon();
  const message = dialogService.getMessage();
  const buttons = dialogService.getButtons();
  const type = dialogService.getType();

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
    <DialogView
      visible={dialogService.isVisible()}
      onClose={handleClose}
      closable={true}
      afterClose={afterClose}
      message={message}
      type={type}
      icon={icon}
      buttons={buttons.length ? buttons.map((button, index) => (
        <Button size='large' onClick={handlerClickButton(button)} key={button} type={index === buttons.length - 1 ? 'primary' : 'secondary'} className={styles.button}>{ mnemonicButtonLabel(button, true) }</Button>
      )) : (
        <Button size='large' onClick={handleClose} type='primary' className={styles.button}>{localize('dialog.confirm')}</Button>
      )}
    />
  );
});
