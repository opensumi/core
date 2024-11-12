import React, { FC, useCallback, useEffect, useState } from 'react';

import { Button, Dialog as DialogView } from '@opensumi/ide-components';
import { localize, strings, useInjectable } from '@opensumi/ide-core-browser';

import { IDialogService } from '../common';

export const Dialog: FC = () => {
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const icon = dialogService.getIcon();
  const message = dialogService.getMessage();
  const detail = dialogService.getDetail();
  const buttons = dialogService.getButtons();
  const type = dialogService.getType();

  const [visible, setVisible] = useState(dialogService.visible);

  // props will transfer to Overlay component
  const customProps = dialogService.getProps();

  const afterClose = useCallback(() => {
    dialogService.reset();
  }, [dialogService]);

  const handleClose = useCallback(() => {
    dialogService.hide();
  }, [dialogService]);

  const handlerClickButton = useCallback(
    (value: string) => {
      dialogService.hide(value);
    },
    [dialogService],
  );

  useEffect(() => {
    const dispose = dialogService.onDidDialogVisibleChange((visible) => {
      setVisible(visible);
    });
    return () => {
      dispose.dispose();
    };
  }, []);

  return (
    <DialogView
      visible={visible}
      onClose={handleClose}
      closable={dialogService.closable ?? true}
      afterClose={afterClose}
      message={message}
      detail={detail}
      type='confirm'
      messageType={type}
      icon={icon}
      keyboard={true}
      buttons={
        buttons ? (
          buttons.map((button, index) => (
            <Button
              size='large'
              onClick={() => handlerClickButton(button)}
              key={button}
              type={index === buttons.length - 1 ? 'primary' : 'secondary'}
            >
              {strings.mnemonicButtonLabel(button, true)}
            </Button>
          ))
        ) : (
          <Button size='large' onClick={handleClose} type='primary'>
            {localize('dialog.confirm')}
          </Button>
        )
      }
      {...customProps}
    />
  );
};
