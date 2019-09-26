import * as React from 'react';
import { observer, useObservable } from 'mobx-react-lite';
import { useInjectable, localize } from '@ali/ide-core-browser';
import * as styles from './debug-console.module.less';

export const DebugConsoleToolbarView = observer(() => {

  return <div className={styles.debug_console_toolbar}>
    <select>
      <option value='default'>{localize('debug.console.panel.default')}</option>
    </select>
  </div>;
});
