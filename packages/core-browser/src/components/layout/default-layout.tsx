import React from 'react';

import { SlotRenderer } from '../../react-providers/slot';

import { BoxPanel } from './box-panel';
import { SplitPanel } from './split-panel';

export const getStorageValue = () => {
  // 启动时渲染的颜色和尺寸，弱依赖
  let savedLayout: { [key: string]: { size: number; currentId: string } } = {};
  let savedColors: { [colorKey: string]: string } = {};
  try {
    savedLayout = JSON.parse(localStorage.getItem('layout') || '{}');
    savedColors = JSON.parse(localStorage.getItem('theme') || '{}');
  } catch (err) {}
  return {
    layout: savedLayout,
    colors: savedColors,
  };
};

export const DefaultLayout = ToolbarActionBasedLayout;

export function ToolbarActionBasedLayout() {
  const { colors, layout } = getStorageValue();
  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer backgroundColor={colors.menuBarBackground} defaultSize={0} slot='top' z-index={2} />
      <SplitPanel id='main-horizontal' flex={1}>
        <SlotRenderer
          backgroundColor={colors.sideBarBackground}
          slot='left'
          isTabbar={true}
          defaultSize={layout.left?.currentId ? layout.left?.size || 310 : 49}
          minResize={204}
          minSize={49}
        />
        <SplitPanel id='main-vertical' minResize={300} flexGrow={1} direction='top-to-bottom'>
          <SlotRenderer backgroundColor={colors.editorBackground} flex={2} flexGrow={1} minResize={200} slot='main' />
          <SlotRenderer
            backgroundColor={colors.panelBackground}
            flex={1}
            defaultSize={layout.bottom?.size}
            minResize={160}
            slot='bottom'
            isTabbar={true}
          />
        </SplitPanel>
        <SlotRenderer
          backgroundColor={colors.sideBarBackground}
          slot='right'
          isTabbar={true}
          defaultSize={layout.right?.currentId ? layout.right?.size || 310 : 0}
          minResize={200}
          minSize={0}
        />
      </SplitPanel>
      <SlotRenderer backgroundColor={colors.statusBarBackground} defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
}
