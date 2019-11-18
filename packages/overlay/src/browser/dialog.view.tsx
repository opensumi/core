import * as React from 'react';
import 'antd/lib/button/style/index.css';
import { observer } from 'mobx-react-lite';
import * as styles from './dialog.module.less';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { IDialogService } from '../common';
import { getIcon } from '@ali/ide-core-browser';
import clx from 'classnames';
import { mnemonicButtonLabel } from '@ali/ide-core-common/lib/utils/strings';
import { Overlay } from '@ali/ide-core-browser/lib/components/overlay';
import { Button } from '@ali/ide-core-browser/lib/components';

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
    <Overlay
      visible={dialogService.isVisible()}
      onClose={handleClose}
      afterClose={afterClose}>
      <div className={styles.content}>
        {icon && <div style={{ color: icon.color }} className={clx(styles.icon, getIcon(icon.className))}/>}
        {typeof message === 'string' ? (<span className={styles.message}>{ message }</span>) : message}
      </div>
      <div className={styles.buttonWrap}>
        {buttons.length ? buttons.map((button, index) => (
          <Button onClick={handlerClickButton(button)} key={button} type={index === buttons.length - 1 ? 'primary' : 'secondary'} className={styles.button}>{ mnemonicButtonLabel(button, true) }</Button>
        )) : (
          <Button onClick={handleClose} type='primary' className={styles.button}>{CONFIRM}</Button>
        )}
      </div>
    </Overlay>
  );
});
