import React from 'react';

import styles from './styles.module.less';

export const TitleBar: React.FC<{
  title: string;
  menubar?: React.ReactNode;
  height?: number;
}> = React.memo((props) => (
  <div className={styles.titlebar} style={{ height: props.height }}>
    <h1>{props.title}</h1>
    {props.menubar || null}
  </div>
));

TitleBar.displayName = 'TitleBar';
