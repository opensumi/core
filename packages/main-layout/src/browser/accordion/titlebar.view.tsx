import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IDesignStyleService } from '@opensumi/ide-core-browser/lib/design';

import styles from './styles.module.less';

export const TitleBar: React.FC<{
  title: string;
  menubar?: React.ReactNode;
  height?: number;
}> = React.memo((props) => {
  const designService = useInjectable<IDesignStyleService>(IDesignStyleService);
  return (
    <div className={designService.getStyles('titlebar', styles.titlebar)} style={{ height: props.height }}>
      <h1>{props.title}</h1>
      {props.menubar || null}
    </div>
  );
});

TitleBar.displayName = 'TitleBar';
