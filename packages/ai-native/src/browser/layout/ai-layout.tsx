import React, { useEffect, useMemo, useState } from 'react';

import { SlotLocation, SlotRenderer, useInjectable } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel, getStorageValue } from '@opensumi/ide-core-browser/lib/components';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';

import { AI_CHAT_VIEW_ID } from '../../common';

import { AIPanelLayoutService } from './panel-layout.service';

// 使用 UA 判断是否为移动设备
const isMobileDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const AILayout = () => {
  const { layout } = getStorageValue();
  const designLayoutConfig = useInjectable(DesignLayoutConfig);
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const [panelLayout, setPanelLayout] = useState(() => panelLayoutService.getLayoutMode());

  useEffect(() => {
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setPanelLayout(mode);
    });
    setPanelLayout(panelLayoutService.getLayoutMode());

    return () => disposable.dispose();
  }, [panelLayoutService]);

  // 判断是否应该显示完整布局
  const shouldShowFullLayout = !isMobileDevice();

  // 移动端模式：只渲染 AI_CHAT_VIEW_ID，添加 mobile class
  if (!shouldShowFullLayout) {
    return (
      <SlotRenderer
        slot={AI_CHAT_VIEW_ID}
        isTabbar={true}
        defaultSize={layout['AI-Chat']?.currentId ? layout['AI-Chat']?.size || 360 : 0}
        maxResize={420}
        minResize={280}
        minSize={0}
      />
    );
  }

  // 正常模式：渲染完整布局
  const defaultRightSize = useMemo(
    () => (designLayoutConfig.useMergeRightWithLeftPanel ? 0 : 49),
    [designLayoutConfig.useMergeRightWithLeftPanel],
  );

  const aiChatSlot = (
    <SlotRenderer
      key='ai-chat'
      slot={AI_CHAT_VIEW_ID}
      isTabbar={true}
      defaultSize={layout['AI-Chat']?.currentId ? layout['AI-Chat']?.size || 360 : 0}
      maxResize={1080}
      minResize={280}
      minSize={0}
    />
  );

  const editorWithBottomPanel = (id: string) => (
    <SplitPanel key={id} id={id} minResize={300} flexGrow={1} direction='top-to-bottom'>
      <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
      <SlotRenderer
        flex={1}
        defaultSize={layout[SlotLocation.panel]?.currentId ? layout[SlotLocation.panel]?.size : 24}
        minResize={160}
        slot={SlotLocation.panel}
        isTabbar={true}
      />
    </SplitPanel>
  );

  const workbenchViewSlot = (
    <SlotRenderer
      key='workbench-view'
      slot={SlotLocation.view}
      isTabbar={true}
      defaultSize={layout[SlotLocation.view]?.currentId ? layout[SlotLocation.view]?.size || 310 : 49}
      minResize={280}
      minSize={49}
    />
  );

  const extendViewSlot = (
    <SlotRenderer
      key='extend-view'
      slot={SlotLocation.extendView}
      isTabbar={true}
      defaultSize={
        layout[SlotLocation.extendView]?.currentId ? layout[SlotLocation.extendView]?.size || 360 : defaultRightSize
      }
      minResize={280}
      minSize={defaultRightSize}
    />
  );

  const workbenchChildren =
    panelLayout === 'agentic'
      ? [editorWithBottomPanel('main-vertical-agentic'), workbenchViewSlot, extendViewSlot]
      : [workbenchViewSlot, editorWithBottomPanel('main-vertical'), extendViewSlot];

  const workbench = (
    <SplitPanel
      key='workbench'
      id={panelLayout === 'agentic' ? 'main-horizontal-agentic' : 'main-horizontal'}
      flex={1}
      direction={'left-to-right'}
      resizeHandleClassName={'design-slot_resize_horizontal'}
    >
      {workbenchChildren}
    </SplitPanel>
  );

  const layoutChildren = panelLayout === 'agentic' ? [aiChatSlot, workbench] : [workbench, aiChatSlot];

  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer id='top' defaultSize={layout.top?.currentId ? layout.top?.size || 32 : 32} slot='top' />
      <SplitPanel
        id={panelLayout === 'agentic' ? 'main-horizontal-ai-agentic' : 'main-horizontal-ai'}
        flex={1}
        direction={'left-to-right'}
        resizeHandleClassName={'design-slot_resize_horizontal'}
      >
        {layoutChildren}
      </SplitPanel>
      <SlotRenderer id='statusbar' defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
};
