import cls from 'classnames';
import React, { useCallback, useEffect, useMemo } from 'react';

import {
  ComponentRegistryInfo,
  SlotLocation,
  useAutorun,
  useContextMenus,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { EDirection } from '@opensumi/ide-core-browser/lib/components';
import {
  EnhanceIcon,
  EnhanceIconWithCtxMenu,
  EnhancePopover,
  HorizontalVertical,
} from '@opensumi/ide-core-browser/lib/components/ai-native';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
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
import { TabRendererBase, TabbarConfig } from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';
import { TabbarService, TabbarServiceFactory } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';

import { AI_CHAT_VIEW_ID } from '../../common';

import styles from './layout.module.less';

const ChatTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  useEffect(() => {
    tabbarService.setIsLatter(true);
  }, [tabbarService]);
  return (
    <div style={{ width: 0 }}>
      <TabbarViewBase tabSize={0} MoreTabView={IconElipses} TabView={IconTabView} barSize={0} panelBorderSize={1} />
    </div>
  );
};

export const AIChatTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
  <TabRendererBase
    side={AI_CHAT_VIEW_ID}
    direction={EDirection.LeftToRight}
    id={styles.ai_chat_panel}
    className={cls(className, `${AI_CHAT_VIEW_ID}-slot`)}
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

export const AIChatTabRendererWithTab = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
  <TabRendererBase
    side={AI_CHAT_VIEW_ID}
    direction={EDirection.RightToLeft}
    id={styles.ai_chat_panel}
    className={cls(className, `${AI_CHAT_VIEW_ID}-slot`, 'design_right_slot')}
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

export const AILeftTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => <DesignLeftTabRenderer className={className} components={components} tabbarView={AILeftTabbarRenderer} />;

const AILeftTabbarRenderer: React.FC = () => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.right);
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

export const AIRightTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => {
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.right);
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
