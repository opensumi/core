import clsx from 'classnames';
import React, { useCallback } from 'react';

import { ComponentRegistryInfo, SlotLocation, useContextMenus, useInjectable } from '@opensumi/ide-core-browser';
import { EDirection } from '@opensumi/ide-core-browser/lib/components';
import {
  EnhanceIcon,
  EnhanceIconWithCtxMenu,
  HorizontalVertical,
  EnhancePopover,
} from '@opensumi/ide-core-browser/lib/components/ai-native';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { LeftTabbarRenderer } from '@opensumi/ide-main-layout/lib/browser/tabbar/bar.view';
import { BaseTabPanelView, ContainerView } from '@opensumi/ide-main-layout/lib/browser/tabbar/panel.view';
import {
  BottomTabRenderer,
  LeftTabRenderer,
  TabRendererBase,
} from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';
import { TabbarService, TabbarServiceFactory } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';

import { Ai_CHAT_CONTAINER_VIEW_ID } from '../../../common';

import styles from './layout.module.less';

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
        navMenu.length === 0 ? null : (
          <EnhanceIconWithCtxMenu
            wrapperClassName={styles.extra_bottom_icon}
            iconClass={navMenu[0].icon}
            menuNodes={navMenu[0].children}
            skew={{ x: -8, y: -4 }}
          />
        )
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
}) => {
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.right);

  const handleClose = useCallback(() => {
    tabbarService.currentContainerId = '';
  }, []);

  const ContainerViewFn = useCallback((props: { component: ComponentRegistryInfo; side: string; titleMenu: IMenu }) => {
    const { component } = props;
    const { options } = component;
    return (
      <ContainerView
        {...props}
        renderContainerWrap={({ children }) => (
          <div className={styles.right_slot_container_wrap}>
            <div className={styles.header}>
              <span className={styles.title}>{options && options.title}</span>
              <div className={styles.side}>
                <EnhancePopover id={'ai_right_panel_header_close'} title='关闭'>
                  <EnhanceIcon icon='close' onClick={handleClose} />
                </EnhancePopover>
              </div>
            </div>
            <div className={styles.container}>{children}</div>
          </div>
        )}
      />
    );
  }, []);

  return (
    <TabRendererBase
      side={SlotLocation.right}
      direction={EDirection.RightToLeft}
      id={VIEW_CONTAINERS.RIGHT_TABBAR_PANEL}
      className={clsx(className, styles.ai_right_slot)}
      components={components}
      TabbarView={() => null}
      TabpanelView={() => <BaseTabPanelView PanelView={ContainerViewFn} />}
    />
  );
};

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
