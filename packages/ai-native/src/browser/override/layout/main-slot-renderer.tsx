import React, { useEffect } from 'react';

import { InternalMenu } from '@opensumi/ide-components/lib/menu';
import SubMenu from '@opensumi/ide-components/lib/menu/SubMenu';
import { SlotRenderer } from '@opensumi/ide-core-browser';
import { IChildComponentProps, SplitPanel, getStorageValue } from '@opensumi/ide-core-browser/lib/components';

import { Ai_CHAT_CONTAINER_VIEW_ID } from '../../../common';

import * as styles from './layout.module.less';

export const AiMainSlotRenderer = (props?: IChildComponentProps) => {
  const { layout } = getStorageValue();

  useEffect(() => {
    InternalMenu.defaultProps.className = styles.ai_internal_menu;
    SubMenu.defaultProps.className = styles.ai_internal_sub_menu;
  }, []);

  return (
    <SplitPanel
      id='ai-native-main-horizontal-0'
      flex={1}
      className={styles.ai_native_panel_container}
      resizeHandleClassName={styles.ai_native_slot_resize_horizontal}
    >
      <SplitPanel
        id='ai-native-main-horizontal-1'
        flex={1}
        flexGrow={1}
        resizeHandleClassName={styles.ai_native_slot_resize_horizontal}
      >
        <SlotRenderer
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
          className={styles.ai_native_slot_main}
        >
          <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
          <SlotRenderer flex={1} defaultSize={layout.bottom?.size} minResize={160} slot='bottom' isTabbar={true} />
        </SplitPanel>
        <SlotRenderer slot='right' isTabbar={true} defaultSize={0} maxResize={480} minResize={280} minSize={0} />
      </SplitPanel>
      <SlotRenderer
        slot={Ai_CHAT_CONTAINER_VIEW_ID}
        isTabbar={true}
        defaultSize={420}
        maxResize={480}
        minResize={280}
        minSize={0}
      />
    </SplitPanel>
  );
};
