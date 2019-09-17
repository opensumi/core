import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './status-bar.module.less';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import StatusBarItem from './status-bar-item.view';
// import { IStatusBarService } from '..';
import { IStatusBarService} from '@ali/ide-core-browser/lib/services';
import cls from 'classnames';

export const StatusBarView = observer(() => {

  const statusBar: IStatusBarService = useInjectable(IStatusBarService);
  const backgroundColor = statusBar.getBackgroundColor();

  return (
    <div className={styles.statusBar} style={{ backgroundColor }}>
      <div className={cls(styles.area, styles.left)}>
        { statusBar.leftEntries.map((entry) => (
          <StatusBarItem key={entry.id} {...entry} />
        )) }
      </div>
      <div className={cls(styles.area, styles.right)}>
      { statusBar.rightEntries.map((entry) => (
          <StatusBarItem key={entry.id} {...entry} />
        )) }
      </div>
    </div>
  );
});
