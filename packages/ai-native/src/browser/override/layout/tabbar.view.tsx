import clsx from 'classnames';
import React, { useCallback } from 'react';

import { ComponentRegistryInfo, SlotLocation, useInjectable } from '@opensumi/ide-core-browser';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { LeftTabbarRenderer, splitVisibleTabs } from '@opensumi/ide-main-layout/lib/browser/tabbar/bar.view';
import {
  BaseTabPanelView,
  ContainerView,
  LeftTabPanelRenderer,
  RightTabPanelRenderer,
} from '@opensumi/ide-main-layout/lib/browser/tabbar/panel.view';
import { TabRendererBase, TabbarConfig } from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';
import { TabbarService, TabbarServiceFactory } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';

import { Ai_CHAT_CONTAINER_VIEW_ID } from '../../../common';
import { HorizontalVertical } from '../../components/lineVertical';

// 将注册在 right bar 的组件渲染到 left bar
export const AiLeftTabbarRenderer: React.FC = () => {
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.right);

  const renderOtherVisibleContainers = useCallback(
    ({ props, renderContainers }) => {
      const { currentContainerId, handleTabClick } = tabbarService;
      const visibleContainers = tabbarService.visibleContainers.filter((container) => !container.options?.hideTab);

      return (
        <>
          <HorizontalVertical />
          {visibleContainers.map((component) => renderContainers(component, handleTabClick, currentContainerId))}
        </>
      );
    },
    [tabbarService],
  );

  return <LeftTabbarRenderer renderOtherVisibleContainers={renderOtherVisibleContainers} />;
};

export const AiLeftTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
  <TabRendererBase
    side='left'
    direction='left-to-right'
    id={VIEW_CONTAINERS.LEFT_TABBAR_PANEL}
    className={clsx(className, 'left-slot')}
    components={components}
    TabbarView={AiLeftTabbarRenderer}
    TabpanelView={LeftTabPanelRenderer}
  />
);

// right 面板只保留 panel
export const AiRightTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
  <TabRendererBase
    side='right'
    direction='right-to-left'
    id={VIEW_CONTAINERS.RIGHT_TABBAR_PANEL}
    className={clsx(className, 'right-slot')}
    components={components}
    TabbarView={() => null}
    TabpanelView={RightTabPanelRenderer}
  />
);

export const ChatTabPanelRenderer: React.FC = () => (
  <BaseTabPanelView PanelView={ContainerView} currentContainerId={Ai_CHAT_CONTAINER_VIEW_ID} />
);

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
    id={'ai_chat_panel'}
    className={clsx(className, 'ai_chat-slot')}
    components={components}
    TabbarView={() => null}
    TabpanelView={ChatTabPanelRenderer}
  />
);
