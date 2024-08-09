import React from 'react';

import { SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel, getStorageValue } from '@opensumi/ide-core-browser/lib/components';

import { AI_CHAT_VIEW_ID } from '../../common';

export const AILayout = () => {
  const { layout } = getStorageValue();

  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer id='top' defaultSize={layout.top?.currentId ? layout.top?.size || 35 : 0} slot='top' />
      <SplitPanel
        id='main-horizontal-ai'
        flex={1}
        direction={'left-to-right'}
        resizeHandleClassName={'design-slot_resize_horizontal'}
      >
        <SplitPanel
          id='main-horizontal'
          flex={1}
          flexGrow={1}
          direction={'left-to-right'}
          resizeHandleClassName={'design-slot_resize_horizontal'}
        >
          <SlotRenderer
            slot='left'
            isTabbar={true}
            defaultSize={layout.left?.currentId ? layout.left?.size || 310 : 49}
            minResize={280}
            minSize={49}
          />
          <SplitPanel id='main-vertical' minResize={300} flexGrow={1} direction='top-to-bottom'>
            <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
            <SlotRenderer
              flex={1}
              defaultSize={layout.bottom?.currentId ? layout.bottom?.size : 0}
              minResize={160}
              slot='bottom'
              isTabbar={true}
            />
          </SplitPanel>
          <SlotRenderer
            slot='right'
            isTabbar={true}
            defaultSize={layout.right?.currentId ? layout.right?.size || 360 : 0}
            maxResize={360}
            minResize={280}
            minSize={0}
          />
        </SplitPanel>
        <SlotRenderer
          slot={AI_CHAT_VIEW_ID}
          isTabbar={true}
          defaultSize={layout.AI_Chat?.currentId ? layout.AI_Chat?.size || 360 : 0}
          maxResize={420}
          minResize={280}
          minSize={0}
        />
      </SplitPanel>
      <SlotRenderer id='statusbar' defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
};
