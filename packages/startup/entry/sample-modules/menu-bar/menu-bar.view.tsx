import * as React from 'react';

import { AppConfig, useInjectable } from '@opensumi/ide-core-browser';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { MenuBar } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.view';

import styles from './menu-bar.module.less';

/**
 * Custom menu bar component.
 * Add a logo in here, and keep
 * opensumi's original menubar.
 */
export const MenuBarView = () => {
  const appConfig = useInjectable<AppConfig>(AppConfig);

  return (
    <div
      id={VIEW_CONTAINERS.MENUBAR}
      className={styles.menu_bar_view}
      style={{ height: appConfig.layoutViewSize!.menubarHeight }}
    >
      <span className={styles.menu_bar_logo} />
      <MenuBar />
    </div>
  );
};
