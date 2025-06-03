import React, { useMemo } from 'react';

import { SlotLocation, SlotRenderer, useInjectable } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel, getStorageValue } from '@opensumi/ide-core-browser/lib/components';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';

import { AI_CHAT_VIEW_ID } from '../../common';

export const AILayout = () => {
  const { layout } = getStorageValue();
  const designLayoutConfig = useInjectable(DesignLayoutConfig);

  const defaultRightSize = useMemo(
    () => (designLayoutConfig.useMergeRightWithLeftPanel ? 0 : 49),
    [designLayoutConfig.useMergeRightWithLeftPanel],
  );

  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer id='top' defaultSize={layout.top?.currentId ? layout.top?.size || 32 : 32} slot='top' />
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
            slot={SlotLocation.view}
            isTabbar={true}
            defaultSize={layout[SlotLocation.view]?.currentId ? layout[SlotLocation.view]?.size || 310 : 49}
            minResize={280}
            minSize={49}
          />
          <SplitPanel id='main-vertical' minResize={300} flexGrow={1} direction='top-to-bottom'>
            <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
            <SlotRenderer
              flex={1}
              defaultSize={layout[SlotLocation.panel]?.currentId ? layout[SlotLocation.panel]?.size : 24}
              minResize={160}
              slot={SlotLocation.panel}
              isTabbar={true}
            />
          </SplitPanel>
          <SlotRenderer
            slot={SlotLocation.extendView}
            isTabbar={true}
            defaultSize={
              layout[SlotLocation.extendView]?.currentId
                ? layout[SlotLocation.extendView]?.size || 360
                : defaultRightSize
            }
            minResize={280}
            minSize={defaultRightSize}
          />
        </SplitPanel>
        <SlotRenderer
          slot={AI_CHAT_VIEW_ID}
          isTabbar={true}
          defaultSize={layout['AI-Chat']?.currentId ? layout['AI-Chat']?.size || 360 : 0}
          maxResize={420}
          minResize={280}
          minSize={0}
        />
      </SplitPanel>
      <SlotRenderer id='statusbar' defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
};
