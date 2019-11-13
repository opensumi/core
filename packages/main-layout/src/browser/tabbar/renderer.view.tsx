import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo } from '@ali/ide-core-browser';
import { RightTabbarRenderer } from './bar.view';
import { RightTabPanelRenderer } from './panel.view';

export const TabRendererBase: React.FC<{
  side: string;
  className?: string;
  components: ComponentRegistryInfo[];
  direction?: Layout.direction;
  TabbarView: React.FC<{components: ComponentRegistryInfo[]; side: string; }>;
  TabpanelView: React.FC<{components: ComponentRegistryInfo[]; side: string; }>;
}> = (({ className, components, direction = 'left-to-right', TabbarView, side, TabpanelView, ...restProps }) => {
  return (
    <div className={clsx( styles.tab_container, className )} style={{flexDirection: Layout.getFlexDirection(direction)}}>
      <TabbarView side={side} components={components} />
      <TabpanelView side={side} components={components} />
    </div>
  );
});

export const RightTabRenderer = ({className, components}: {className: string, components: ComponentRegistryInfo[]}) => (
  <TabRendererBase side='right' direction='right-to-left' className={clsx(className, 'right-slot')} components={components} TabbarView={RightTabbarRenderer} TabpanelView={RightTabPanelRenderer} />
);
