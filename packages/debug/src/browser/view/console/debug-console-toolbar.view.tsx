import React from 'react';
import { observer } from 'mobx-react-lite';
import { localize, isElectronRenderer } from '@ali/ide-core-browser';
import { Select, Option } from '@ali/ide-components';
import { Select as NativeSelect } from '@ali/ide-core-browser/lib/components/select';
import styles from './debug-console.module.less';

export const DebugConsoleToolbarView = observer(() => {
  if (isElectronRenderer()) {
    return (
      <NativeSelect value='default' className={styles.debug_console_select}>
        <option value='default'>{localize('debug.console.panel.default')}</option>
      </NativeSelect>);
  }

  return <div className={styles.debug_console_toolbar}>
    <Select size='small' value='default' className={styles.debug_console_select}>
      <Option value='default' label={localize('debug.console.panel.default')}>{localize('debug.console.panel.default')}</Option>
    </Select>
  </div>;
});
