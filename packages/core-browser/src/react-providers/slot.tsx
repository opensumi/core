/**
 * 前端提供一套 Slot 的注册和渲染的机制
 */

import * as React from 'react';
import { ConfigContext } from './config-provider';

export enum RenderNameEnum {
  mainLayout = 'core-main-layout',
  menuBar = 'core-menu-bar',
  leftPanel = 'core-left-panel',
  topPanel = 'core-top-panel',
  bottomPanel = 'core-bottom-panel',
  rightPanel = 'core-right-panel',
  statusBar = 'core-status-bar',
  commandBar = 'core-command-bar',
}

export function SlotRenderer({ name }: { name: string }) {
  const { slotMap } = React.useContext(ConfigContext);

  const Component = slotMap.get(name);
  return Component && <Component /> || null;
}
