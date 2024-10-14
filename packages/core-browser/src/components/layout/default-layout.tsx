import React from 'react';

import { SlotRenderer } from '../../react-providers/slot';

import { BoxPanel } from './box-panel';
import { SplitPanel } from './split-panel';

export interface ILayoutConfigCache {
  [key: string]: { size?: number; currentId?: string };
}

export const getStorageValue = () => {
  // 启动时渲染的颜色和尺寸，弱依赖
  let savedLayout: ILayoutConfigCache = {};
  let savedColors: { [colorKey: string]: string } = {};
  try {
    const layoutConfigStr = localStorage.getItem('layout');
    if (layoutConfigStr) {
      savedLayout = JSON.parse(layoutConfigStr);
    }

    const themeConfigStr = localStorage.getItem('theme');
    if (themeConfigStr) {
      savedColors = JSON.parse(themeConfigStr);
    }
  } catch (err) {}

  return {
    layout: fixLayout(savedLayout),
    colors: savedColors,
  };
};

export const DefaultLayout = ToolbarActionBasedLayout;

export function ToolbarActionBasedLayout(
  props: {
    topSlotDefaultSize?: number;
    topSlotZIndex?: number;
  } = {},
) {
  const { layout } = getStorageValue();
  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer id='top' defaultSize={props.topSlotDefaultSize || 0} slot='top' zIndex={props.topSlotZIndex} />
      <SplitPanel id='main-horizontal' flex={1}>
        <SlotRenderer
          slot='left'
          isTabbar={true}
          defaultSize={layout.left?.currentId ? layout.left?.size || 310 : 49}
          minResize={280}
          maxResize={480}
          minSize={49}
        />
        <SplitPanel id='main-vertical' minResize={300} flexGrow={1} direction='top-to-bottom'>
          <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
          <SlotRenderer
            flex={1}
            defaultSize={layout.bottom?.currentId ? layout.bottom?.size : 24}
            minResize={160}
            slot='bottom'
            isTabbar={true}
          />
        </SplitPanel>
        <SlotRenderer
          slot='right'
          isTabbar={true}
          defaultSize={layout.right?.currentId ? layout.right?.size || 310 : 0}
          minResize={280}
          maxResize={480}
          minSize={0}
        />
      </SplitPanel>
      <SlotRenderer id='statusBar' defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
}

/**
 * if layout has currentId, but its size is zero
 * we cannot acknowledge the currentId, so we should remove it
 */
export function fixLayout(layout: ILayoutConfigCache) {
  const newLayout = { ...layout };
  for (const key in layout) {
    if (!layout[key]) {
      continue;
    }

    if (!layout[key].size) {
      newLayout[key].currentId = '';
    }
  }
  return newLayout;
}
