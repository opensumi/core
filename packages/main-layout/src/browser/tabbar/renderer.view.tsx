import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo, useInjectable } from '@ali/ide-core-browser';
import { RightTabbarRenderer, LeftTabbarRenderer, BottomTabbarRenderer, NextBottomTabbarRenderer } from './bar.view';
import { RightTabPanelRenderer, LeftTabPanelRenderer, BottomTabPanelRenderer, NextBottomTabPanelRenderer } from './panel.view';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TabbarServiceFactory, TabbarService } from './tabbar.service';

// TODO 将过深的prop挪到这里
export const TabbarConfig = React.createContext<{
  side: string;
  direction: Layout.direction;
}>({
  side: 'left',
  direction: 'left-to-right',
});

export const TabRendererBase: React.FC<{
  side: string;
  className?: string;
  components: ComponentRegistryInfo[];
  direction?: Layout.direction;
  TabbarView: React.FC;
  TabpanelView: React.FC;
  noAccordion?: boolean;
}> = (({ className, components, direction = 'left-to-right', TabbarView, side, TabpanelView, noAccordion, ...restProps }) => {
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side, noAccordion);
  components.forEach((component) => {
    tabbarService.registerContainer(component.options!.containerId, component);
  });
  return (
    <div className={clsx( styles.tab_container, className )} style={{flexDirection: Layout.getFlexDirection(direction)}}>
      <TabbarConfig.Provider value={{side, direction}}>
        <TabbarView />
        <TabpanelView />
      </TabbarConfig.Provider>
    </div>
  );
});

export const RightTabRenderer = ({className, components}: {className: string, components: ComponentRegistryInfo[]}) => (
  <TabRendererBase side='right' direction='right-to-left' className={clsx(className, 'right-slot')} components={components} TabbarView={RightTabbarRenderer} TabpanelView={RightTabPanelRenderer} />
);

export const LeftTabRenderer = ({className, components}: {className: string, components: ComponentRegistryInfo[]}) => (
  <TabRendererBase side='left' direction='left-to-right' className={clsx(className, 'left-slot')} components={components} TabbarView={LeftTabbarRenderer} TabpanelView={LeftTabPanelRenderer} />
);

export const BottomTabRenderer = ({className, components}: {className: string, components: ComponentRegistryInfo[]}) => (
  <TabRendererBase side='bottom' direction='top-to-bottom' className={clsx(className, 'bottom-slot')} components={components} TabbarView={BottomTabbarRenderer} TabpanelView={BottomTabPanelRenderer} noAccordion={true} />
);

export const NextBottomTabRenderer = ({className, components}: {className: string, components: ComponentRegistryInfo[]}) => (
  <TabRendererBase side='bottom' direction='bottom-to-top' className={clsx(className, 'bottom-slot')} components={components} TabbarView={NextBottomTabbarRenderer} TabpanelView={NextBottomTabPanelRenderer} />
);
