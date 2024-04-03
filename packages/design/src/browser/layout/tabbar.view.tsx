import cls from 'classnames';
import React, { FC } from 'react';

import { ComponentRegistryInfo } from '@opensumi/ide-core-browser';
import {
  BottomTabRenderer,
  LeftTabRenderer,
  RightTabRenderer,
} from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';

export const DesignLeftTabRenderer = ({
  className,
  components,
  tabbarView,
}: {
  className: string;
  components: ComponentRegistryInfo[];
  tabbarView?: React.FC;
}) => (
  <LeftTabRenderer className={cls(className, 'design_left_slot')} components={components} tabbarView={tabbarView} />
);

export const DesignBottomTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => <BottomTabRenderer className={cls(className, 'design_bottom_slot')} components={components} />;

export const DesignRightTabRenderer = ({
  className,
  components,
  tabbarView,
  tabpanelView,
}: {
  components: ComponentRegistryInfo[];
  className?: string;
  tabbarView?: FC<{}>;
  tabpanelView?: FC<{}>;
}) => (
  <RightTabRenderer
    className={cls('design_right_slot', className)}
    components={components}
    tabbarView={tabbarView}
    tabpanelView={tabpanelView}
  />
);
