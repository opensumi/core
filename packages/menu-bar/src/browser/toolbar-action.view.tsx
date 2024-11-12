import cls from 'classnames';
import React from 'react';

import { ToolbarLocation } from '@opensumi/ide-core-browser';

import styles from './toolbar-action.module.less';

export const ToolbarAction = () => (
  <div className={styles.toolbarActionsWrapper}>
    <ToolbarLocation
      location='menu-left'
      preferences={{ noDropDown: true }}
      className={cls(styles.toolbarActions, styles.toolbarActionsLeft)}
    />
    <ToolbarLocation location='menu-right' className={cls(styles.toolbarActions, styles.toolbarActionsRight)} />
  </div>
);
