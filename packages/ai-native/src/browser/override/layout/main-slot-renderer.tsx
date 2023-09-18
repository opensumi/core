import React, { useCallback } from 'react';
import { SlotRenderer } from '@opensumi/ide-core-browser';
import { SplitPanel, getStorageValue } from '@opensumi/ide-core-browser/lib/components';

// import * as styles from './layout.module.less';

export const AiMainSlotRenderer = () => {
  const { colors, layout } = getStorageValue();

  return (
    <SplitPanel
      id='ai-native-main-horizontal'
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
        isTabbar={true}
        defaultSize={layout.right?.currentId ? layout.right?.size || 310 : 0}
        maxResize={480}
        minResize={280}
      />
      <SlotRenderer
        slot='ai-chat'
        isTabbar={true}
        defaultSize={layout['ai-chat']?.currentId ? layout['ai-chat']?.size || 280 : 280}
        minResize={280}
      />
    </SplitPanel>
  )
}