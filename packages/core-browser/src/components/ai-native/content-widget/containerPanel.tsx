import React from 'react';

import styles from './styles.module.less';

export const ContentWidgetContainerPanel = (props: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div className={styles.inline_chat_container_panel} style={props.style}>
    {props.children}
  </div>
);
