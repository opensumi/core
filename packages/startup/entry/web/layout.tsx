import React from 'react';

import { AiMainSlotRenderer } from '@opensumi/ide-ai-native/lib/browser/override/layout/main-slot-renderer';
import { SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, getStorageValue, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

export function DefaultLayout() {
  const { colors, layout } = getStorageValue();
  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer backgroundColor={colors.menuBarBackground} defaultSize={35} slot='top' z-index={2} />
      <AiMainSlotRenderer id={'ai-main-slot'} overflow={'hidden'} flex={1} />
      {/* <SplitPanel id='main-horizontal' flex={1}>
        <SlotRenderer
          backgroundColor={colors.sideBarBackground}
          slot='left'
          isTabbar={true}
          defaultSize={layout.left?.currentId ? layout.left?.size || 310 : 49}
          minResize={280}
          maxResize={480}
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
          slot='right'
          isTabbar={true}
          defaultSize={layout.right?.currentId ? layout.right?.size || 310 : 0}
          maxResize={480}
          minResize={280}
          minSize={0}
        />
      </SplitPanel> */}
      <SlotRenderer backgroundColor={colors.statusBarBackground} defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
}
