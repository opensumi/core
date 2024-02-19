import cls from 'classnames';
import React from 'react';

import { ComponentRegistryInfo } from '@opensumi/ide-core-browser';
import { LeftTabbarRenderer } from '@opensumi/ide-main-layout/lib/browser/tabbar/bar.view';
import {
  BottomTabRenderer,
  LeftTabRenderer,
  RightTabRenderer,
} from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';

import styles from './layout.module.less';

export const DesignLeftTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
  <LeftTabRenderer
    className={cls(className, styles.ai_left_slot)}
    components={components}
    tabbarView={LeftTabbarRenderer}
  />
);

// right 面板只保留 panel
export const DesignRightTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => (
    <RightTabRenderer
      className={cls(className, styles.ai_left_slot)}
      components={components}
      tabbarView={LeftTabbarRenderer}
    />
  );

// 编辑器 bottom 面板
export const DesignBottomTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => <BottomTabRenderer className={cls(className, styles.ai_bottom_slot)} components={components} />;
