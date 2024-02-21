import cls from 'classnames';
import React from 'react';

import { ComponentRegistryInfo } from '@opensumi/ide-core-browser';
import { BottomTabRenderer, LeftTabRenderer } from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';

export const DesignLeftTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => <LeftTabRenderer className={cls(className, 'design_left_slot')} components={components} />;

// 编辑器 bottom 面板
export const DesignBottomTabRenderer = ({
  className,
  components,
}: {
  className: string;
  components: ComponentRegistryInfo[];
}) => <BottomTabRenderer className={cls(className, 'design_bottom_slot')} components={components} />;
