import cls from 'classnames';
import React, { useCallback, useMemo } from 'react';

import {
  ComponentRegistryInfo,
  SlotLocation,
  fastdom,
  useAutorun,
  useContextMenus,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { EXPLORER_CONTAINER_ID, SCM_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
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

const AGENTIC_VIEW_ACTIVITY_BAR_SIZE = 49;
const AGENTIC_VIEW_DEFAULT_SIZE = 310;
const AGENTIC_VIEW_MAX_SIZE = 480;
const AGENTIC_VISIBLE_VIEW_CONTAINER_IDS = new Set([EXPLORER_CONTAINER_ID, SCM_CONTAINER_ID]);

const isAgenticVisibleViewContainer = (component: ComponentRegistryInfo) => {
  const containerId = component.options?.containerId;
  return !!containerId && AGENTIC_VISIBLE_VIEW_CONTAINER_IDS.has(containerId);
};

const ChatTabbarRenderer: React.FC<{ disableAutoAdjust?: boolean }> = ({ disableAutoAdjust }) => (
  <div style={disableAutoAdjust ? { width: 0, overflow: 'hidden' } : { width: 0 }}>
    <TabbarViewBase
      tabSize={0}
      MoreTabView={IconElipses}
      TabView={IconTabView}
      barSize={0}
      panelBorderSize={0}
      {...(disableAutoAdjust ? { disableAutoAdjust: true } : {})}
    />
  </div>
);

function useFixedResizeSideHandle(enabled: boolean, targetIsLatter: boolean): ResizeHandle {
  const resizeHandle = React.useContext(PanelContext);

  return React.useMemo<ResizeHandle>(() => {
    if (!enabled) {
      return resizeHandle;
    }

    return {
      ...resizeHandle,
      setSize: (targetSize?: number) => resizeHandle.setSize(targetSize, targetIsLatter),
      setRelativeSize: (prev: number, next: number) => resizeHandle.setRelativeSize(prev, next, targetIsLatter),
      getSize: () => resizeHandle.getSize(targetIsLatter),
      getRelativeSize: () => resizeHandle.getRelativeSize(targetIsLatter),
      lockSize: (lock: boolean | undefined) => resizeHandle.lockSize(lock, targetIsLatter),
      setMaxSize: (lock: boolean | undefined) => resizeHandle.setMaxSize(lock, targetIsLatter),
    };
  }, [enabled, resizeHandle, targetIsLatter]);
}

function getAgenticViewRestoreSize(tabbarService: TabbarService): number {
  const cachedSize = tabbarService.prevSize;

  if (typeof cachedSize === 'number' && Number.isFinite(cachedSize) && cachedSize > AGENTIC_VIEW_ACTIVITY_BAR_SIZE) {
    return Math.min(cachedSize, AGENTIC_VIEW_MAX_SIZE);
  }

  return AGENTIC_VIEW_DEFAULT_SIZE;
}

function useRestoreAgenticViewSize(
  tabbarService: TabbarService,
  resizeHandle: ResizeHandle,
  currentContainerId: string | undefined,
) {
  React.useEffect(() => {
    if (!currentContainerId) {
      return;
    }

    let disposed = false;
    const frameDisposables: Array<{ dispose(): void }> = [];

    const restoreIfCollapsed = () => {
      if (disposed) {
        return;
      }

      const frameDisposable = fastdom.measureAtNextFrame(() => {
        if (disposed || !tabbarService.currentContainerId.get()) {
          return;
        }

        const currentSize = resizeHandle.getSize(true);
        if (!Number.isFinite(currentSize) || currentSize <= AGENTIC_VIEW_ACTIVITY_BAR_SIZE) {
          resizeHandle.setSize(getAgenticViewRestoreSize(tabbarService));
        }
      });
      frameDisposables.push(frameDisposable);
    };

    restoreIfCollapsed();

    void tabbarService.viewReady.promise.then(() => {
      restoreIfCollapsed();
    });

    return () => {
      disposed = true;
      frameDisposables.forEach((disposable) => disposable.dispose());
    };
  }, [currentContainerId, resizeHandle, tabbarService]);
}

export const AIChatTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const isAgenticLayout = panelLayoutService.getLayoutMode() === 'agentic';
  const aiChatResizeHandle = useFixedResizeSideHandle(true, !isAgenticLayout);

  const renderer = (
    <TabRendererBase
      side={AI_CHAT_VIEW_ID}
      direction={EDirection.LeftToRight}
      id={styles.ai_chat_panel}
      className={cls(className, `${AI_CHAT_VIEW_ID}-slot`)}
      components={components}
      TabbarView={() => <ChatTabbarRenderer disableAutoAdjust={isAgenticLayout} />}
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

  return <PanelContext.Provider value={aiChatResizeHandle}>{renderer}</PanelContext.Provider>;
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
  const aiChatResizeHandle = useFixedResizeSideHandle(true, !isAgenticLayout);

  const renderer = (
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

  return <PanelContext.Provider value={aiChatResizeHandle}>{renderer}</PanelContext.Provider>;
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

  if (!isAgenticLayout) {
    return <DesignLeftTabRenderer className={className} components={components} tabbarView={AILeftTabbarRenderer} />;
  }

  return <AgenticLeftTabRenderer className={className} components={components} />;
};

const AgenticLeftTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => {
  const viewTabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.view);
  const currentContainerId = useAutorun(viewTabbarService.currentContainerId);
  const agenticResizeHandle = useFixedResizeSideHandle(true, true);

  useRestoreAgenticViewSize(viewTabbarService, agenticResizeHandle, currentContainerId);

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
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const isAgenticLayout = panelLayoutService.getLayoutMode() === 'agentic';

  // In Agentic layout, the tabbar and panel both render in SlotLocation.view,
  // so they must share the same tabbar service. Using extendView here causes
  // the panel (listening to `view`) to never see activations from the tabbar.
  const activeSlot = isAgenticLayout ? SlotLocation.view : SlotLocation.extendView;
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(activeSlot);
  const currentContainerId = useAutorun(tabbarService.currentContainerId);

  const extraMenus = React.useMemo(() => layoutService.getExtraMenu(), [layoutService]);
  const [navMenu] = useContextMenus(extraMenus);

  const renderOtherVisibleContainers = useCallback(
    ({ renderContainers }) => {
      const visibleContainers = tabbarService.visibleContainers.filter((container) => {
        if (container.options?.hideTab) {
          return false;
        }

        return !isAgenticLayout || isAgenticVisibleViewContainer(container);
      });

      return (
        <>
          {visibleContainers.length > 0 && <HorizontalVertical margin={'8px auto 0px'} width={'60%'} />}
          {visibleContainers.map((component) => renderContainers(component, tabbarService, currentContainerId))}
        </>
      );
    },
    [currentContainerId, tabbarService, isAgenticLayout],
  );

  return (
    <LeftTabbarRenderer
      renderOtherVisibleContainers={isAgenticLayout ? undefined : renderOtherVisibleContainers}
      isRenderExtraTopMenus={false}
      tabbarViewProps={isAgenticLayout ? { containerFilter: isAgenticVisibleViewContainer } : undefined}
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
