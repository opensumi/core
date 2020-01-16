import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { localize, isElectronRenderer } from '@ali/ide-core-browser';
import { Select, Option } from '@ali/ide-components';
import { Select as NativeSelect } from '@ali/ide-core-browser/lib/components/select';
import * as styles from './debug-console.module.less';

export const DebugConsoleToolbarView = observer(() => {

  if (isElectronRenderer()) {
    return (
      <NativeSelect>
        <option value='default'>{localize('debug.console.panel.default')}</option>
      </NativeSelect>);
  }

  return <div className={styles.debug_console_toolbar}>
    <Select size='small'>
      <Option key='default' value='default' label='default'>{localize('debug.console.panel.default')}</Option>
    </Select>
  </div>;
});
