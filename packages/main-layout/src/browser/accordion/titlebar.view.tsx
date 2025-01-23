import React from 'react';

import { useDesignStyles, useInjectable } from '@opensumi/ide-core-browser';

import { TabbarService, TabbarServiceFactory } from '../tabbar/tabbar.service';

import styles from './styles.module.less';

export const TitleBar: React.FC<{
  title: string;
  menubar?: React.ReactNode;
  height?: number;
  draggable?: boolean;
  side: string;
  containerId: string;
}> = React.memo((props) => {
  const styles_titlebar = useDesignStyles(styles.titlebar, 'titlebar');
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(props.side);

  return (
    <div className={styles_titlebar} style={{ height: props.height }}>
      {!props.draggable && <h1>{props.title}</h1>}
      {!!props.draggable && (
        <h1
          draggable
          style={{ cursor: 'pointer' }}
          onDragStart={(e) => {
            tabbarService.handleDragStart(e, props.containerId);
          }}
          onDragEnd={(e) => {
            tabbarService.handleDragEnd(e);
          }}
        >
          {props.title}
        </h1>
      )}
      {props.menubar || null}
    </div>
  );
});

TitleBar.displayName = 'TitleBar';
