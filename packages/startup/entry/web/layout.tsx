import React from 'react';

import { SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, getStorageValue, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

export function DefaultLayout() {
  const { colors, layout } = getStorageValue();
  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer backgroundColor={colors.menuBarBackground} defaultSize={35} slot='top' z-index={2} />
      <SplitPanel
        id='main-horizontal'
        flex={1}
        className='ai_native_panel_container'
        resizeHandleClassName='ai_native_slot_resize_horizontal'
      >
        <SlotRenderer
          backgroundColor={colors.sideBarBackground}
          slot='left'
          isTabbar={true}
          defaultSize={layout.left?.currentId ? layout.left?.size || 310 : 49}
          minResize={280}
          maxResize={480}
        />
        <SplitPanel
          id='main-vertical'
          minResize={300}
          flexGrow={1}
          direction='top-to-bottom'
          className='ai_native_slot_main'
        >
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
            isTabbar={false}
            defaultSize={layout.right?.currentId ? layout.right?.size || 310 : 320}
            minResize={280}
          />
        {/* <SplitPanel
          id='main-vertical'
          minResize={400}
          direction='left-to-right'
          className='ai_native_slot_main_right'
          // savedSize={900}
        >
          {/* <SlotRenderer
            slot='right'
            isTabbar={false}
            defaultSize={layout.right?.currentId ? layout.right?.size || 310 : 320}
            minResize={280}
            savedSize={450}
          /> */}
          <SlotRenderer
            slot='ai-chat'
            isTabbar={true}
            defaultSize={layout['ai-chat']?.currentId ? layout['ai-chat']?.size || 360 : 360}
            minResize={280}
            // savedSize={450}
          />
      </SplitPanel>
      <SlotRenderer backgroundColor={colors.statusBarBackground} defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
}
