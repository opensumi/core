import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './status-bar.module.less';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import StatusBarItem from './status-bar-item.view';
import { StatusBarService } from './status-bar.service';
import cls from 'classnames';

export const StatusBar = observer(() => {

  const statusBarService = useInjectable(StatusBarService);
  const backgroundColor = statusBarService.getBackgroundColor();

  return (
    <div className={styles.statusBar} style={{ backgroundColor }}>
      <div className={cls(styles.area, styles.left)}>
        { statusBarService.leftEntries.map((entrie) => (
          <StatusBarItem key={entrie.text} {...entrie} />
        )) }
      </div>
      <div className={cls(styles.area, styles.right)}>
      { statusBarService.rightEntries.map((entrie) => (
          <StatusBarItem key={entrie.text} {...entrie} />
        )) }
      </div>
    </div>
  );
});
