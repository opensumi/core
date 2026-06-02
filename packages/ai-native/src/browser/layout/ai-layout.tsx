import React, { useEffect, useMemo, useRef, useState } from 'react';

import { IClientApp, SlotLocation, SlotRenderer, runWhenIdle, useInjectable } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel, getStorageValue } from '@opensumi/ide-core-browser/lib/components';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_CHAT_VIEW_ID } from '../../common';

import { AIPanelLayoutService, getPanelLayoutStorageKey } from './panel-layout.service';

export const AILayout = () => {
  const designLayoutConfig = useInjectable(DesignLayoutConfig);
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const didDefaultOpenAIChat = useRef(false);
  const [panelLayout, setPanelLayout] = useState(() => panelLayoutService.getLayoutMode());
  const { layout } = getStorageValue(getPanelLayoutStorageKey(panelLayout));

  useEffect(() => {
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setPanelLayout(mode);
    });
    setPanelLayout(panelLayoutService.getLayoutMode());

    return () => disposable.dispose();
  }, [panelLayoutService]);

  useEffect(() => {
    layoutService.setLayoutStateKey(getPanelLayoutStorageKey(panelLayout), { saveCurrent: false });
  }, [layoutService, panelLayout]);

  const defaultRightSize = useMemo(
    () => (designLayoutConfig.useMergeRightWithLeftPanel ? 0 : 49),
    [designLayoutConfig.useMergeRightWithLeftPanel],
  );
  const aiChatLayout = layout[AI_CHAT_VIEW_ID];
  const hasCachedAIChatLayout = Object.prototype.hasOwnProperty.call(layout, AI_CHAT_VIEW_ID);
  const shouldDefaultOpenAIChat = panelLayout === 'agentic' && !hasCachedAIChatLayout;
  const defaultAIChatSize = panelLayout === 'agentic' ? 1080 : 360;

  useEffect(() => {
    if (!shouldDefaultOpenAIChat || didDefaultOpenAIChat.current) {
      return;
    }

    didDefaultOpenAIChat.current = true;
    let disposed = false;
    const aiChatReady = layoutService.getTabbarService(AI_CHAT_VIEW_ID).viewReady.promise;
    Promise.all([clientApp.appInitialized.promise, aiChatReady]).then(() => {
      runWhenIdle(() => {
        if (!disposed) {
          layoutService.toggleSlot(AI_CHAT_VIEW_ID, true, defaultAIChatSize);
        }
      });
    });

    return () => {
      disposed = true;
    };
  }, [clientApp, defaultAIChatSize, layoutService, shouldDefaultOpenAIChat]);

  const aiChatSlot = (
    <SlotRenderer
      key='ai-chat'
      slot={AI_CHAT_VIEW_ID}
      isTabbar={true}
      defaultSize={
        aiChatLayout?.currentId
          ? aiChatLayout.size || defaultAIChatSize
          : shouldDefaultOpenAIChat
          ? defaultAIChatSize
          : 0
      }
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
      minResize={300}
      flexGrow={1}
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
        initialResizeOnMount={panelLayout === 'agentic'}
      >
        {layoutChildren}
      </SplitPanel>
      <SlotRenderer id='statusbar' defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
};
