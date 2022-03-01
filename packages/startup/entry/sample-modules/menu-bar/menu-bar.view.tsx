import * as React from 'react';
import { MenuBar } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.view';

import * as styles from './menu-bar.module.less';

/**
 * Custom menu bar component.
 * Add a logo in here, and keep
 * opensumi's original menubar.
 */
export const MenuBarView = () => (
  <div className={styles.menu_bar_view}>
    <span className={styles.menu_bar_logo} />
    <MenuBar />
  </div>
);
