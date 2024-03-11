import cls from 'classnames';
import React from 'react';

import { ComponentRegistryInfo } from '@opensumi/ide-core-browser';
import { BaseTabPanelView, ContainerView } from '@opensumi/ide-main-layout/lib/browser/tabbar/panel.view';
import { TabRendererBase } from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';

import { Ai_CHAT_CONTAINER_VIEW_ID } from '../../common';

import styles from './layout.module.less';

// ai_chat 面板
export const AiChatTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
  <TabRendererBase
    side={Ai_CHAT_CONTAINER_VIEW_ID}
    direction='right-to-left'
    id={styles.ai_chat_panel}
    className={cls(className, `${Ai_CHAT_CONTAINER_VIEW_ID}-slot`)}
    components={components}
    TabbarView={() => null}
    TabpanelView={() => <BaseTabPanelView PanelView={ContainerView} currentContainerId={Ai_CHAT_CONTAINER_VIEW_ID} />}
  />
);
