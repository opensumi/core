import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { useCallback, memo } from 'react';

import { StatusBarEntry } from '@opensumi/ide-core-browser';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { generateCtxMenu, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';
import { IStatusBarService } from '@opensumi/ide-core-browser/lib/services';

import { StatusBarItem } from './status-bar-item.view';
import styles from './status-bar.module.less';

export const StatusBarView = memo(
  observer(() => {
    const statusBar: IStatusBarService = useInjectable(IStatusBarService);
    const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
    const backgroundColor = statusBar.getBackgroundColor();
    const color = statusBar.getColor();

    const handleCtxMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
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
          {statusBar.leftEntries.length
            ? statusBar.leftEntries.map((entry: StatusBarEntry, index: number) => (
                <StatusBarItem key={`${entry.entryId}-${index}`} {...{ ...entry, color: color ?? entry.color }} />
              ))
            : null}
        </div>
        <div className={cls(styles.area, styles.right)}>
          {statusBar.rightEntries.length
            ? statusBar.rightEntries.map((entry: StatusBarEntry, index: number) => (
                <StatusBarItem key={`${entry.entryId}-${index}`} {...{ ...entry, color: color ?? entry.color }} />
              ))
            : null}
        </div>
      </div>
    );
  }),
);

StatusBarView.displayName = 'StatusBar';
