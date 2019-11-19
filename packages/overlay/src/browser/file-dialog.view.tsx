import * as React from 'react';
import { IDialogService } from '../common';
import { Button } from '@ali/ide-core-browser/lib/components';
import * as styles from './dialog.module.less';
import { useInjectable } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';

export const FileDialog = observer(() => {
  const dialogService = useInjectable<IDialogService>(IDialogService);

  function hide(value?: string[]) {
    dialogService.hide('1');
  }

  return (
    <div>
      <div>选择文件</div>
      <div className={styles.buttonWrap}>
        <Button onClick={() => hide()} type='secondary' className={styles.button}>关闭</Button>
        <Button onClick={() => hide(['1', '2'])} type='primary' className={styles.button}>确定</Button>
      </div>
    </div>
  );
});
