import React from 'react';

import { SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel, getStorageValue } from '@opensumi/ide-core-browser/lib/components';

export function DefaultLayout() {
  const { layout } = getStorageValue();
  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer defaultSize={35} slot='top' z-index={2} />
      <SplitPanel id='main-horizontal' flex={1}>
        <SlotRenderer
          slot='left'
          isTabbar={true}
          // 这里初始状态下会激活左侧第一个 Tab，因此默认宽度应该为侧边栏 (49px)+ 侧边面板宽度 (261px)
          defaultSize={layout.left?.currentId ? layout.left?.size || 310 : 310}
          minResize={280}
          maxResize={480}
          minSize={49}
        />
        <SplitPanel id='main-vertical' minResize={300} flexGrow={1} direction='top-to-bottom'>
          <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
          <SlotRenderer flex={1} defaultSize={layout.bottom?.size} minResize={160} slot='bottom' isTabbar={true} />
        </SplitPanel>
        <SlotRenderer
          slot='right'
          isTabbar={true}
          defaultSize={layout.right?.currentId ? layout.right?.size || 310 : 0}
          maxResize={480}
          minResize={280}
          minSize={0}
        />
      </SplitPanel>
      <SlotRenderer defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
}
