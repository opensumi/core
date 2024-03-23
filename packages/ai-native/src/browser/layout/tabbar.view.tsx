import cls from 'classnames';
import React, { useCallback } from 'react';

import { ComponentRegistryInfo, SlotLocation, useContextMenus, useInjectable } from '@opensumi/ide-core-browser';
import { EDirection } from '@opensumi/ide-core-browser/lib/components';
import {
  EnhanceIcon,
  EnhanceIconWithCtxMenu,
  EnhancePopover,
  HorizontalVertical,
} from '@opensumi/ide-core-browser/lib/components/ai-native';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { localize } from '@opensumi/ide-core-common';
import { DesignLeftTabRenderer, DesignRightTabRenderer } from '@opensumi/ide-design/lib/browser/layout/tabbar.view';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { LeftTabbarRenderer } from '@opensumi/ide-main-layout/lib/browser/tabbar/bar.view';
import { BaseTabPanelView, ContainerView } from '@opensumi/ide-main-layout/lib/browser/tabbar/panel.view';
import { TabRendererBase } from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';
import { TabbarService, TabbarServiceFactory } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';

import { AI_CHAT_CONTAINER_VIEW_ID } from '../../common';

import styles from './layout.module.less';

export const AIChatTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
  <TabRendererBase
    side={AI_CHAT_CONTAINER_VIEW_ID}
    direction={EDirection.RightToLeft}
    id={styles.ai_chat_panel}
    className={cls(className, `${AI_CHAT_CONTAINER_VIEW_ID}-slot`)}
    components={components}
    TabbarView={() => null}
    TabpanelView={() => <BaseTabPanelView PanelView={ContainerView} currentContainerId={AI_CHAT_CONTAINER_VIEW_ID} />}
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
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.right);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  const extraMenus = React.useMemo(() => layoutService.getExtraMenu(), [layoutService]);
  const [navMenu] = useContextMenus(extraMenus);

  const renderOtherVisibleContainers = useCallback(
    ({ renderContainers }) => {
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

export const AIRightTabRenderer = ({
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
                <EnhancePopover id={'ai_right_panel_header_close'} title={localize('editor.title.context.close')}>
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
    <DesignRightTabRenderer
      components={components}
      tabbarView={() => null}
      tabpanelView={() => <BaseTabPanelView PanelView={ContainerViewFn} />}
    />
  );
};
