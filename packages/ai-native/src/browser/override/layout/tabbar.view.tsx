import clsx from 'classnames';
import React, { useCallback, useMemo } from 'react';

import { ComponentRegistryInfo, SlotLocation, useContextMenus, useInjectable } from '@opensumi/ide-core-browser';
import { ICtxMenuRenderer, MenuNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { LeftTabbarRenderer } from '@opensumi/ide-main-layout/lib/browser/tabbar/bar.view';
import { BaseTabPanelView, ContainerView } from '@opensumi/ide-main-layout/lib/browser/tabbar/panel.view';
import {
  BottomTabRenderer,
  LeftTabRenderer,
  RightTabRenderer,
  TabRendererBase,
} from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';
import { TabbarService, TabbarServiceFactory } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';

import { Ai_CHAT_CONTAINER_VIEW_ID } from '../../../common';
import { EnhanceIcon } from '../../components/Icon';
import { HorizontalVertical } from '../../components/lineVertical';

import * as styles from './layout.module.less';

const RenderExtraMenus = (props: { iconClass?: string; menuNodes: MenuNode[] }) => {
  const { iconClass, menuNodes } = props;

  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number } | undefined>(undefined);
  const iconRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const { x, y, width, height } = rect;

      setAnchor({
        x: x + width - 8,
        y: y + height,
      });
    }
  }, [iconRef.current]);

  const handleClick = React.useCallback(() => {
    if (!anchor) {
      return;
    }

    ctxMenuRenderer.show({
      anchor,
      menuNodes,
    });
  }, [menuNodes, anchor]);

  return (
    <EnhanceIcon
      iconClass={iconClass}
      wrapperClassName={styles.extra_bottom_icon}
      ref={iconRef}
      onClick={handleClick}
    ></EnhanceIcon>
  );
};

// 将注册在 right bar 的组件渲染到 left bar
const AiLeftTabbarRenderer: React.FC = () => {
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.right);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  const extraMenus = React.useMemo(() => layoutService.getExtraMenu(), [layoutService]);
  const [navMenu] = useContextMenus(extraMenus);

  const renderOtherVisibleContainers = useCallback(
    ({ props, renderContainers }) => {
      const { currentContainerId, handleTabClick } = tabbarService;
      const visibleContainers = tabbarService.visibleContainers.filter((container) => !container.options?.hideTab);

      return (
        <>
          <HorizontalVertical margin={'8px auto 0px'} width={'60%'} />
          {visibleContainers.map((component) => renderContainers(component, handleTabClick, currentContainerId))}
        </>
      );
    },
    [tabbarService],
  );

  return (
    <LeftTabbarRenderer
      renderOtherVisibleContainers={renderOtherVisibleContainers}
      isRenderExtraTopMenus={false}
      renderExtraMenus={
        navMenu.length === 0 ? null : <RenderExtraMenus iconClass={navMenu[0].icon} menuNodes={navMenu[0].children} />
      }
    />
  );
};

export const AiLeftTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
  <LeftTabRenderer
    className={clsx(className, styles.ai_left_slot)}
    components={components}
    tabbarView={AiLeftTabbarRenderer}
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
  <RightTabRenderer className={clsx(className, styles.ai_right_slot)} components={components} tabbarView={() => null} />
);

// 编辑器 bottom 面板
export const AiBottomTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => <BottomTabRenderer className={clsx(className, styles.ai_bottom_slot)} components={components} />;

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
    className={clsx(className, `${Ai_CHAT_CONTAINER_VIEW_ID}-slot`)}
    components={components}
    TabbarView={() => null}
    TabpanelView={() => <BaseTabPanelView PanelView={ContainerView} currentContainerId={Ai_CHAT_CONTAINER_VIEW_ID} />}
  />
);
