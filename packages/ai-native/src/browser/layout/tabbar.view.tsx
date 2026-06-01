import cls from 'classnames';
import React, { useCallback, useMemo } from 'react';

import {
  ComponentRegistryInfo,
  SlotLocation,
  useAutorun,
  useContextMenus,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { EDirection, PanelContext, ResizeHandle } from '@opensumi/ide-core-browser/lib/components';
import {
  EnhanceIcon,
  EnhanceIconWithCtxMenu,
  EnhancePopover,
  HorizontalVertical,
} from '@opensumi/ide-core-browser/lib/components/ai-native';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { localize } from '@opensumi/ide-core-common';
import { DesignLeftTabRenderer, DesignRightTabRenderer } from '@opensumi/ide-design/lib/browser/layout/tabbar.view';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import {
  ChatTabbarRenderer2,
  IconElipses,
  IconTabView,
  LeftTabbarRenderer,
  RightTabbarRenderer,
  TabbarViewBase,
} from '@opensumi/ide-main-layout/lib/browser/tabbar/bar.view';
import { BaseTabPanelView, ContainerView } from '@opensumi/ide-main-layout/lib/browser/tabbar/panel.view';
import { TabRendererBase } from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';
import { TabbarService, TabbarServiceFactory } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';

import { AI_CHAT_VIEW_ID } from '../../common';

import styles from './layout.module.less';
import { AIPanelLayoutService } from './panel-layout.service';

const ChatTabbarRenderer: React.FC = () => (
  <div style={{ width: 0, overflow: 'hidden' }}>
    <TabbarViewBase
      tabSize={0}
      MoreTabView={IconElipses}
      TabView={IconTabView}
      barSize={0}
      panelBorderSize={0}
      disableAutoAdjust
    />
  </div>
);

export const AIChatTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const isAgenticLayout = panelLayoutService.getLayoutMode() === 'agentic';

  return (
    <TabRendererBase
      side={AI_CHAT_VIEW_ID}
      direction={isAgenticLayout ? EDirection.LeftToRight : EDirection.RightToLeft}
      id={styles.ai_chat_panel}
      className={cls(className, `${AI_CHAT_VIEW_ID}-slot`, !isAgenticLayout && 'design_right_slot')}
      components={components}
      TabbarView={() => <ChatTabbarRenderer />}
      TabpanelView={() => (
        <BaseTabPanelView
          PanelView={ContainerView}
          PanelViewProps={{
            className: styles.ai_chat_view_container,
          }}
        />
      )}
    />
  );
};

export const AIChatTabRendererWithTab = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const isAgenticLayout = panelLayoutService.getLayoutMode() === 'agentic';

  return (
    <TabRendererBase
      side={AI_CHAT_VIEW_ID}
      direction={isAgenticLayout ? EDirection.LeftToRight : EDirection.RightToLeft}
      id={styles.ai_chat_panel}
      className={cls(className, `${AI_CHAT_VIEW_ID}-slot`, !isAgenticLayout && 'design_right_slot')}
      components={components}
      TabbarView={() => <ChatTabbarRenderer2 />}
      TabpanelView={() => (
        <BaseTabPanelView
          PanelView={ContainerView}
          PanelViewProps={{
            className: styles.ai_chat_view_container,
          }}
        />
      )}
    />
  );
};

export const AILeftTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const isAgenticLayout = panelLayoutService.getLayoutMode() === 'agentic';
  const resizeHandle = React.useContext(PanelContext);
  const agenticResizeHandle = React.useMemo<ResizeHandle>(
    () => ({
      ...resizeHandle,
      setSize: (targetSize?: number) => resizeHandle.setSize(targetSize, true),
      setRelativeSize: (prev: number, next: number) => resizeHandle.setRelativeSize(prev, next, true),
      getSize: () => resizeHandle.getSize(true),
      getRelativeSize: () => resizeHandle.getRelativeSize(true),
      lockSize: (lock: boolean | undefined) => resizeHandle.lockSize(lock, true),
      setMaxSize: (lock: boolean | undefined) => resizeHandle.setMaxSize(lock, true),
    }),
    [resizeHandle],
  );

  if (!isAgenticLayout) {
    return <DesignLeftTabRenderer className={className} components={components} tabbarView={AILeftTabbarRenderer} />;
  }

  return (
    <PanelContext.Provider value={agenticResizeHandle}>
      <TabRendererBase
        side={SlotLocation.view}
        direction={EDirection.RightToLeft}
        id={VIEW_CONTAINERS.LEFT_TABBAR_PANEL}
        className={cls(className, 'left-slot', 'design_left_slot', styles.agentic_view_slot)}
        components={components}
        TabbarView={() => (
          <div className={styles.agentic_view_tab_bar}>
            <AILeftTabbarRenderer />
          </div>
        )}
        TabpanelView={() => <BaseTabPanelView PanelView={ContainerView} />}
      />
    </PanelContext.Provider>
  );
};

const AILeftTabbarRenderer: React.FC = () => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.extendView);
  const currentContainerId = useAutorun(tabbarService.currentContainerId);

  const extraMenus = React.useMemo(() => layoutService.getExtraMenu(), [layoutService]);
  const [navMenu] = useContextMenus(extraMenus);

  const renderOtherVisibleContainers = useCallback(
    ({ renderContainers }) => {
      const visibleContainers = tabbarService.visibleContainers.filter((container) => !container.options?.hideTab);

      return (
        <>
          {visibleContainers.length > 0 && <HorizontalVertical margin={'8px auto 0px'} width={'60%'} />}
          {visibleContainers.map((component) => renderContainers(component, tabbarService, currentContainerId))}
        </>
      );
    },
    [currentContainerId, tabbarService],
  );

  return (
    <LeftTabbarRenderer
      renderOtherVisibleContainers={renderOtherVisibleContainers}
      isRenderExtraTopMenus={false}
      renderExtraMenus={
        <div className={styles.extra_bottom_icon_container}>
          {navMenu.length >= 0
            ? navMenu.map((menu) => (
                <EnhanceIconWithCtxMenu
                  key={menu.id}
                  id={menu.id}
                  wrapperClassName={styles.extra_bottom_icon}
                  iconClass={menu.icon}
                  menuNodes={menu.children}
                  skew={{ x: -8, y: -4 }}
                />
              ))
            : null}
        </div>
      }
    />
  );
};

export const AIRightTabRenderer = ({ components }: { className: string; components: ComponentRegistryInfo[] }) => {
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.extendView);
  const designLayoutConfig = useInjectable<DesignLayoutConfig>(DesignLayoutConfig);

  const handleClose = useCallback(() => {
    tabbarService.updateCurrentContainerId('');
  }, []);

  const ContainerViewFn = useCallback((props: { component: ComponentRegistryInfo; side: string; titleMenu: IMenu }) => {
    const { component } = props;
    const { options } = component;
    return (
      <ContainerView
        {...props}
        customTitleBar={
          <div className={styles.header}>
            <span className={styles.title}>{options && options.title}</span>
            <div className={styles.side}>
              <EnhancePopover id={'ai_right_panel_header_close'} title={localize('editor.title.context.close')}>
                <EnhanceIcon icon='close' onClick={handleClose} />
              </EnhancePopover>
            </div>
          </div>
        }
        renderContainerWrap={({ children }) => (
          <div className={styles.right_slot_container_wrap}>
            <div className={styles.container}>{children}</div>
          </div>
        )}
      />
    );
  }, []);

  const rightTabRenderClassName = useMemo(
    () => (designLayoutConfig.useMergeRightWithLeftPanel ? styles.right_tab_renderer : ''),
    [designLayoutConfig],
  );

  return (
    <DesignRightTabRenderer
      components={components}
      className={rightTabRenderClassName}
      tabbarView={() => <RightTabbarRenderer barSize={0} style={{ width: 0 }} />}
      tabpanelView={() => <BaseTabPanelView PanelView={ContainerViewFn} />}
    />
  );
};
