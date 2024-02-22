import React from 'react';

import { useDesignStyles } from '@opensumi/ide-core-browser';

import styles from './styles.module.less';

export const TitleBar: React.FC<{
  title: string;
  menubar?: React.ReactNode;
  height?: number;
}> = React.memo((props) => {
  const styles_titlebar = useDesignStyles(styles.titlebar);
  return (
    <div className={styles_titlebar} style={{ height: props.height }}>
      <h1>{props.title}</h1>
      {props.menubar || null}
    </div>
  );
});

TitleBar.displayName = 'TitleBar';
