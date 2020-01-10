import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { localize } from '@ali/ide-core-browser';
import { Select, Option } from '@ali/ide-components';
import * as styles from './debug-console.module.less';

export const DebugConsoleToolbarView = observer(() => {

  return <div className={styles.debug_console_toolbar}>
    <Select
      value={'default'}
      options={[<Option key='default' value='default'>{localize('debug.console.panel.default')}</Option>]}
    />
  </div>;
});
