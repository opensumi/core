import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { generateCtxMenu, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';
import { IStatusBarService } from '@opensumi/ide-core-browser/lib/services';

import { StatusBarItem } from './status-bar-item.view';
import styles from './status-bar.module.less';

export const StatusBarView = React.memo(
  observer(() => {
    const statusBar: IStatusBarService = useInjectable(IStatusBarService);
    const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
    const backgroundColor = statusBar.getBackgroundColor();
    const color = statusBar.getColor();

    const handleCtxMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      const result = generateCtxMenu({
        menus: statusBar.contextMenu,
        args: [],
      });

      ctxMenuRenderer.show({
        anchor: { x: e.clientX, y: e.clientY },
        menuNodes: result[1],
      });
    }, []);

    return (
      <div
        id={VIEW_CONTAINERS.STATUSBAR}
        className={styles.statusBar}
        style={{ backgroundColor }}
        onContextMenu={handleCtxMenu}
      >
        <div className={cls(styles.area, styles.left)}>
          {statusBar.leftEntries.map((entry) => (
            <StatusBarItem key={entry.entryId} {...{ ...entry, color: color ?? entry.color }} />
          ))}
        </div>
        <div className={cls(styles.area, styles.right)}>
          {statusBar.rightEntries.map((entry) => (
            <StatusBarItem key={entry.entryId} {...{ ...entry, color: color ?? entry.color }} />
          ))}
        </div>
      </div>
    );
  }),
);
