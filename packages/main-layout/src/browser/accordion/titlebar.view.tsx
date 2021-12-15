import React from 'react';

import styles from './styles.module.less';

export const TitleBar: React.FC<{
  title: string;
  menubar?: React.ReactNode;
}> = React.memo((props) => {
  return (
    <div className={styles.titlebar}>
      <h1>{props.title}</h1>
      {props.menubar || null}
    </div>
  );
});

TitleBar.displayName = 'TitleBar';
