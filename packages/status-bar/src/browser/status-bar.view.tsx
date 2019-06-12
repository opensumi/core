import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './status-bar.module.less';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import StatusBarItem from './status-bar-item.view';
import { StatusBar } from './status-bar.service';
import cls from 'classnames';

export const StatusBarView = observer(() => {

  const statusBar = useInjectable(StatusBar);
  const backgroundColor = statusBar.getBackgroundColor();

  return (
    <div className={styles.statusBar} style={{ backgroundColor }}>
      <div className={cls(styles.area, styles.left)}>
        { statusBar.leftEntries.map((entrie) => (
          <StatusBarItem key={entrie.text} {...entrie} />
        )) }
      </div>
      <div className={cls(styles.area, styles.right)}>
      { statusBar.rightEntries.map((entrie) => (
          <StatusBarItem key={entrie.text} {...entrie} />
        )) }
      </div>
    </div>
  );
});
