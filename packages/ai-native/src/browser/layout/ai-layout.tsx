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
const AGENTIC_WORKBENCH_RESPONSIVE_BREAKPOINT = 980;
const SIDE_SLOT_MAX_RESIZE = 480;

// 使用 UA 判断是否为移动设备
const isMobileDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const ClassicShell = () => {
  const { layout } = getStorageValue();
  const designLayoutConfig = useInjectable(DesignLayoutConfig);

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
          maxResize={1080}
          minResize={280}
          minSize={0}
        />
      </SplitPanel>
      <SlotRenderer id='statusbar' defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
};

export const AgenticShell = () => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const didDefaultOpenAIChat = useRef(false);
  const { layout } = getStorageValue(getPanelLayoutStorageKey('agentic'));
  const [isWorkbenchVisible, setIsWorkbenchVisible] = useState(
    () => panelLayoutService.isAgenticWorkbenchVisible() !== false,
  );

  useEffect(() => {
    layoutService.setLayoutStateKey(getPanelLayoutStorageKey('agentic'), { saveCurrent: false });
  }, [layoutService]);

  useEffect(() => {
    const currentVisibility = panelLayoutService.isAgenticWorkbenchVisible();
    if (typeof currentVisibility === 'boolean') {
      setIsWorkbenchVisible(currentVisibility);
    }

    const disposable = panelLayoutService.onDidChangeAgenticWorkbenchVisibility((visible) => {
      setIsWorkbenchVisible(visible);
    });

    return () => {
      disposable.dispose();
    };
  }, [panelLayoutService]);

  useEffect(() => {
    const updateResponsiveConstraint = () => {
      panelLayoutService.setAgenticWorkbenchWidthConstrained(
        window.innerWidth < AGENTIC_WORKBENCH_RESPONSIVE_BREAKPOINT,
      );
    };

    updateResponsiveConstraint();
    window.addEventListener('resize', updateResponsiveConstraint);
    return () => window.removeEventListener('resize', updateResponsiveConstraint);
  }, [panelLayoutService]);

  const aiChatLayout = layout[AI_CHAT_VIEW_ID];
  const shouldDefaultOpenAIChat = !aiChatLayout?.currentId;
  const defaultAIChatSize = getAIChatDefaultSize('agentic');

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
      maxResize={1440}
      minResize={640}
      minSize={0}
    />
  );

  const expandedAIChatSlot = aiChatSlot;
  const collapsedAIChatSlot = React.cloneElement(aiChatSlot, {
    defaultSize: undefined,
    flex: 1,
    flexGrow: 1,
    maxResize: undefined,
    minResize: 0,
  });

  const editorWithBottomPanel = (id: string) => (
    <SplitPanel
      key={id}
      id={id}
      minResize={AGENTIC_EDITOR_MIN_SIZE}
      minSize={AGENTIC_EDITOR_MIN_SIZE}
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

  const workbench = (
    <SplitPanel
      key='workbench'
      id='main-horizontal-agentic'
      minResize={AGENTIC_WORKBENCH_MIN_RESIZE}
      flexGrow={1}
      direction={'left-to-right'}
      resizeHandleClassName={'design-slot_resize_horizontal'}
    >
      {[editorWithBottomPanel('main-vertical-agentic'), workbenchViewSlot]}
    </SplitPanel>
  );

  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer id='top' defaultSize={layout.top?.currentId ? layout.top?.size || 32 : 32} slot='top' />
      <SplitPanel
        id='main-horizontal-ai-agentic'
        flex={1}
        direction={'left-to-right'}
        resizeHandleClassName={'design-slot_resize_horizontal'}
      >
        {isWorkbenchVisible ? [expandedAIChatSlot, workbench] : [collapsedAIChatSlot]}
      </SplitPanel>
      <SlotRenderer id='statusbar' defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
};

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
