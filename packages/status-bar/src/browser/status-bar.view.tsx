import cls from 'classnames';
import React, { memo, useCallback } from 'react';

import { StatusBarEntry, useAutorun, useEventDrivenState } from '@opensumi/ide-core-browser';
import { LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { ICtxMenuRenderer, generateCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';
import { IStatusBarService } from '@opensumi/ide-core-browser/lib/services';

import { StatusBarItem } from './status-bar-item.view';
import styles from './status-bar.module.less';

export const StatusBarView = memo(() => {
  const statusBar: IStatusBarService = useInjectable(IStatusBarService);
  const leftEntries = useAutorun(statusBar.leftEntries);
  const rightEntries = useAutorun(statusBar.rightEntries);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
  const layoutViewSize = useInjectable<LayoutViewSizeConfig>(LayoutViewSizeConfig);

  const backgroundColor = useEventDrivenState(statusBar.emitter, 'backgroundColor', () =>
    statusBar.getBackgroundColor(),
  );
  const foregroundColor = useEventDrivenState(statusBar.emitter, 'color', () => statusBar.getColor());

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
      style={{ backgroundColor, height: layoutViewSize.statusBarHeight + 'px' }}
      onContextMenu={handleCtxMenu}
    >
      <div className={cls(styles.area, styles.left)}>
        {leftEntries.length
          ? leftEntries.map((entry: StatusBarEntry, index: number) => (
              <StatusBarItem
                side='left'
                key={`${entry.entryId}-${index}`}
                {...{ ...entry, color: foregroundColor ?? entry.color }}
              />
            ))
          : null}
      </div>
      <div className={cls(styles.area, styles.right)}>
        {rightEntries.length
          ? rightEntries.map((entry: StatusBarEntry, index: number) => (
              <StatusBarItem
                side='right'
                key={`${entry.entryId}-${index}`}
                {...{ ...entry, color: foregroundColor ?? entry.color }}
              />
            ))
          : null}
      </div>
    </div>
  );
});

StatusBarView.displayName = 'StatusBar';
