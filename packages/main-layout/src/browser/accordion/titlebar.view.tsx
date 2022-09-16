import React from 'react';

import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';

import styles from './styles.module.less';

export const TitleBar: React.FC<{
  title: string;
  menubar?: React.ReactNode;
}> = React.memo((props) => (
  <div className={styles.titlebar} style={{ height: LAYOUT_VIEW_SIZE.PANEL_TITLEBAR_HEIGHT - 1 }}>
    <h1>{props.title}</h1>
    {props.menubar || null}
  </div>
));

TitleBar.displayName = 'TitleBar';
