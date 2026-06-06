import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  IClientApp,
  PreferenceService,
  SlotLocation,
  SlotRenderer,
  runWhenIdle,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel, getStorageValue } from '@opensumi/ide-core-browser/lib/components';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { PanelLayoutMode } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_CHAT_VIEW_ID } from '../../common';

import { AIPanelLayoutService, getAIChatDefaultSize, getPanelLayoutStorageKey } from './panel-layout.service';

const AGENTIC_EDITOR_MIN_SIZE = 360;
const AGENTIC_WORKBENCH_MIN_RESIZE = 640;
const CLASSIC_WORKBENCH_MIN_RESIZE = 300;
const SIDE_SLOT_MAX_RESIZE = 480;

const AIWorkbenchShell = ({ panelLayout }: { panelLayout: PanelLayoutMode }) => {
  const designLayoutConfig = useInjectable(DesignLayoutConfig);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const didDefaultOpenAIChat = useRef(false);
  const { layout } = getStorageValue(getPanelLayoutStorageKey(panelLayout));

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
  const defaultAIChatSize = getAIChatDefaultSize(panelLayout);
  const isAgenticLayout = panelLayout === 'agentic';
  const aiChatMinResize = isAgenticLayout ? 640 : 280;
  const aiChatMaxResize = isAgenticLayout ? 1440 : 1080;
  const editorMinSize = isAgenticLayout ? AGENTIC_EDITOR_MIN_SIZE : CLASSIC_WORKBENCH_MIN_RESIZE;
  const workbenchMinResize = isAgenticLayout ? AGENTIC_WORKBENCH_MIN_RESIZE : CLASSIC_WORKBENCH_MIN_RESIZE;

  const getSideSlotSize = (slot: SlotLocation, activeFallbackSize: number, inactiveFallbackSize: number) => {
    const slotLayout = layout[slot];
    if (!slotLayout?.currentId) {
      return inactiveFallbackSize;
    }

    return Math.min(slotLayout.size || activeFallbackSize, SIDE_SLOT_MAX_RESIZE);
  };

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
      maxResize={aiChatMaxResize}
      minResize={aiChatMinResize}
      minSize={0}
    />
  );

  const editorWithBottomPanel = (id: string) => (
    <SplitPanel
      key={id}
      id={id}
      minResize={editorMinSize}
      minSize={editorMinSize}
      flexGrow={1}
      direction='top-to-bottom'
    >
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
      defaultSize={getSideSlotSize(SlotLocation.view, 310, 49)}
      minResize={280}
      maxResize={SIDE_SLOT_MAX_RESIZE}
      minSize={49}
    />
  );

  const extendViewSlot = (
    <SlotRenderer
      key='extend-view'
      slot={SlotLocation.extendView}
      isTabbar={true}
      defaultSize={isAgenticLayout ? defaultRightSize : getSideSlotSize(SlotLocation.extendView, 360, defaultRightSize)}
      minResize={280}
      maxResize={SIDE_SLOT_MAX_RESIZE}
      minSize={defaultRightSize}
    />
  );

  const workbenchChildren =
    panelLayout === 'agentic'
      ? [editorWithBottomPanel('main-vertical-agentic'), workbenchViewSlot]
      : [workbenchViewSlot, editorWithBottomPanel('main-vertical'), extendViewSlot];

  const workbench = (
    <SplitPanel
      key='workbench'
      id={panelLayout === 'agentic' ? 'main-horizontal-agentic' : 'main-horizontal'}
      minResize={workbenchMinResize}
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

export const ClassicShell = () => <AIWorkbenchShell panelLayout='classic' />;

export const AgenticShell = () => <AIWorkbenchShell panelLayout='agentic' />;

export const AIShellRoot = () => {
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const [panelLayout, setPanelLayout] = useState<PanelLayoutMode>();

  useEffect(() => {
    let disposed = false;
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      if (!disposed) {
        setPanelLayout(mode);
      }
    });

    preferenceService.ready.then(() => {
      if (!disposed) {
        setPanelLayout(panelLayoutService.getLayoutMode());
      }
    });

    return () => {
      disposed = true;
      disposable.dispose();
    };
  }, [panelLayoutService, preferenceService]);

  if (!panelLayout) {
    return null;
  }

  return panelLayout === 'agentic' ? <AgenticShell /> : <ClassicShell />;
};

export const AILayout = AIShellRoot;
