import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

let panelLayoutMode: 'classic' | 'agentic' = 'classic';
let storedLayout: Record<string, { currentId?: string; size?: number }> = {};
let storedLayouts: Record<string, Record<string, { currentId?: string; size?: number }>> = {};
const mockToggleSlot = jest.fn();
const mockPreferenceServiceToken = Symbol('PreferenceService');
let panelLayoutChangeListener: ((mode: 'classic' | 'agentic') => void) | undefined;
let agenticWorkbenchVisible = true;
let agenticWorkbenchWidthConstrained = false;
const agenticWorkbenchVisibilityListeners = new Set<(visible: boolean) => void>();

jest.mock('@opensumi/ide-core-browser', () => {
  const React = require('react');
  return {
    SlotLocation: {
      top: 'top',
      view: 'view',
      extendView: 'extendView',
      main: 'main',
      statusBar: 'statusBar',
      panel: 'panel',
    },
    IClientApp: Symbol('CLIENT_APP_TOKEN'),
    PreferenceService: mockPreferenceServiceToken,
    runWhenIdle: (callback: () => void) => {
      callback();
      return { dispose: jest.fn() };
    },
    SlotRenderer: ({
      slot,
      id,
      defaultSize,
      maxResize,
      minResize,
      minSize,
    }: {
      slot: string;
      id?: string;
      defaultSize?: number;
      maxResize?: number;
      minResize?: number;
      minSize?: number;
    }) =>
      React.createElement('div', {
        'data-slot': slot,
        'data-id': id,
        'data-default-size': defaultSize,
        'data-max-resize': maxResize,
        'data-min-resize': minResize,
        'data-min-size': minSize,
      }),
    useInjectable: (token: any) => {
      if (token.name === 'DesignLayoutConfig') {
        return { useMergeRightWithLeftPanel: false };
      }
      if (token.name === 'AIPanelLayoutService') {
        return {
          getLayoutMode: () => panelLayoutMode,
          onDidChangePanelLayout: (listener: (mode: 'classic' | 'agentic') => void) => {
            panelLayoutChangeListener = listener;
            return { dispose: jest.fn() };
          },
          isAgenticWorkbenchVisible: () =>
            panelLayoutMode === 'agentic' ? agenticWorkbenchVisible && !agenticWorkbenchWidthConstrained : undefined,
          onDidChangeAgenticWorkbenchVisibility: (listener: (visible: boolean) => void) => {
            agenticWorkbenchVisibilityListeners.add(listener);
            return { dispose: () => agenticWorkbenchVisibilityListeners.delete(listener) };
          },
          setAgenticWorkbenchWidthConstrained: (constrained: boolean) => {
            const previousVisible = agenticWorkbenchVisible && !agenticWorkbenchWidthConstrained;
            agenticWorkbenchWidthConstrained = constrained;
            const nextVisible = agenticWorkbenchVisible && !agenticWorkbenchWidthConstrained;
            if (previousVisible !== nextVisible) {
              agenticWorkbenchVisibilityListeners.forEach((listener) => listener(nextVisible));
            }
            return nextVisible;
          },
        };
      }
      if (String(token) === 'Symbol(CLIENT_APP_TOKEN)') {
        return {
          appInitialized: {
            promise: new Promise(() => {}),
          },
        };
      }
      if (token === mockPreferenceServiceToken) {
        return {
          ready: {
            then: (callback: () => void) => {
              callback();
              return Promise.resolve();
            },
          },
        };
      }
      if (String(token) === 'Symbol(IMainLayoutService)') {
        return {
          toggleSlot: mockToggleSlot,
          setLayoutStateKey: jest.fn(),
          getTabbarService: () => ({
            viewReady: {
              promise: new Promise(() => {}),
            },
          }),
        };
      }
      return {};
    },
  };
});

jest.mock('@opensumi/ide-main-layout', () => ({
  IMainLayoutService: Symbol('IMainLayoutService'),
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => {
  const React = require('react');
  return {
    BoxPanel: ({ children }: React.PropsWithChildren) => React.createElement('div', { 'data-box': true }, children),
    SplitPanel: ({
      id,
      children,
      initialResizeOnMount,
    }: React.PropsWithChildren<{ id: string; initialResizeOnMount?: boolean }>) =>
      React.createElement(
        'div',
        { 'data-split': id, 'data-initial-resize-on-mount': initialResizeOnMount ? 'true' : 'false' },
        React.Children.toArray(children).map((child: React.ReactElement, index: number) =>
          React.createElement(
            'div',
            {
              key: index,
              'data-resize-child': true,
              'data-child-id': child?.props?.id,
              'data-child-slot': child?.props?.slot,
              'data-child-flex': child?.props?.flex,
              'data-child-flex-grow': child?.props?.flexGrow,
              'data-child-min-resize': child?.props?.minResize,
              'data-child-min-size': child?.props?.minSize,
              'data-child-max-resize': child?.props?.maxResize,
            },
            child,
          ),
        ),
      ),
    getStorageValue: (layoutStorageKey = 'layout') => ({ layout: storedLayouts[layoutStorageKey] || storedLayout }),
  };
});

jest.mock('@opensumi/ide-core-browser/lib/layout/constants', () => ({
  DesignLayoutConfig: class DesignLayoutConfig {},
}));

jest.mock('../../src/browser/layout/panel-layout.service', () => ({
  AIPanelLayoutService: class AIPanelLayoutService {},
  getPanelLayoutStorageKey: (mode: 'classic' | 'agentic') => (mode === 'agentic' ? 'layout.ai.agentic' : 'layout'),
  getAIChatDefaultSize: (mode: 'classic' | 'agentic') => (mode === 'agentic' ? 840 : 360),
}));

describe('AILayout BDD', () => {
  let container: HTMLDivElement;
  let root: Root;

  const getSlots = () =>
    Array.from(container.querySelectorAll('[data-slot]')).map((node) => node.getAttribute('data-slot'));
  const getSplitChildIds = (id: string) =>
    Array.from(container.querySelectorAll(`[data-split="${id}"] > [data-resize-child]`)).map(
      (node) => node.getAttribute('data-child-id') || node.getAttribute('data-child-slot'),
    );
  const getSplitChildProps = (id: string) =>
    Array.from(container.querySelectorAll(`[data-split="${id}"] > [data-resize-child]`)).map((node) => ({
      id: node.getAttribute('data-child-id') || node.getAttribute('data-child-slot'),
      flex: node.getAttribute('data-child-flex'),
      flexGrow: node.getAttribute('data-child-flex-grow'),
      minResize: node.getAttribute('data-child-min-resize'),
      minSize: node.getAttribute('data-child-min-size'),
      maxResize: node.getAttribute('data-child-max-resize'),
    }));
  const getSlotProps = (slot: string) => {
    const node = container.querySelector(`[data-slot="${slot}"]`);
    return {
      defaultSize: node?.getAttribute('data-default-size'),
      maxResize: node?.getAttribute('data-max-resize'),
      minResize: node?.getAttribute('data-min-resize'),
      minSize: node?.getAttribute('data-min-size'),
    };
  };
  const getSplitProps = (id: string) => {
    const node = container.querySelector(`[data-split="${id}"]`);
    return {
      initialResizeOnMount: node?.getAttribute('data-initial-resize-on-mount'),
    };
  };

  beforeEach(() => {
    panelLayoutMode = 'classic';
    storedLayout = {};
    storedLayouts = {};
    panelLayoutChangeListener = undefined;
    agenticWorkbenchVisible = true;
    agenticWorkbenchWidthConstrained = false;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366, writable: true });
    agenticWorkbenchVisibilityListeners.clear();
    mockToggleSlot.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('Given classic layout, when the shell root renders, then it selects the classic shell', async () => {
    const { AIShellRoot } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AIShellRoot />);
    });

    expect(container.querySelector('[data-split="main-horizontal-ai"]')).toBeTruthy();
    expect(container.querySelector('[data-split="main-horizontal-ai-agentic"]')).toBeFalsy();
  });

  it('Given agentic layout, when the shell root renders, then it selects the agentic shell', async () => {
    panelLayoutMode = 'agentic';
    const { AIShellRoot } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AIShellRoot />);
    });

    expect(container.querySelector('[data-split="main-horizontal-ai-agentic"]')).toBeTruthy();
    expect(container.querySelector('[data-split="main-horizontal-ai"]')).toBeFalsy();
  });

  it('Given the shell root is mounted, when the panel layout changes, then it switches shells without a reload', async () => {
    panelLayoutMode = 'agentic';
    const { AIShellRoot } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AIShellRoot />);
    });

    expect(container.querySelector('[data-split="main-horizontal-ai-agentic"]')).toBeTruthy();

    act(() => {
      panelLayoutMode = 'classic';
      panelLayoutChangeListener?.('classic');
    });

    expect(container.querySelector('[data-split="main-horizontal-ai"]')).toBeTruthy();
    expect(container.querySelector('[data-split="main-horizontal-ai-agentic"]')).toBeFalsy();
  });

  it('Given classic layout, when it renders, then the workbench appears before AI chat', async () => {
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlots()).toEqual(['top', 'view', 'main', 'panel', 'extendView', 'AI-Chat', 'statusBar']);
    expect(container.querySelector('[data-split="main-horizontal-ai"]')).toBeTruthy();
    expect(getSplitProps('main-horizontal-ai')).toEqual({ initialResizeOnMount: 'false' });
    expect(getSplitChildIds('main-horizontal-ai')).toEqual(['main-horizontal', 'AI-Chat']);
    expect(getSplitChildIds('main-horizontal')).toEqual(['view', 'main-vertical', 'extendView']);
  });

  it('Given classic layout, when dragging the AI split handle, then the workbench is the flex-grow resize target', async () => {
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSplitChildProps('main-horizontal-ai')).toEqual([
      { id: 'main-horizontal', flex: '1', flexGrow: '1', minResize: null, minSize: null, maxResize: null },
      { id: 'AI-Chat', flex: null, flexGrow: null, minResize: '280', minSize: '0', maxResize: '1080' },
    ]);
  });

  it('Given classic layout has no cached active containers, when it renders, then side slots keep their collapsed defaults', async () => {
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('view')).toEqual({ defaultSize: '49', maxResize: null, minResize: '280', minSize: '49' });
    expect(getSlotProps('extendView')).toEqual({
      defaultSize: '49',
      maxResize: null,
      minResize: '280',
      minSize: '49',
    });
    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '0',
      maxResize: '1080',
      minResize: '280',
      minSize: '0',
    });
  });

  it('Given agentic layout, when it renders, then AI chat is before the workbench', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlots()).toEqual(['top', 'AI-Chat', 'main', 'panel', 'view', 'statusBar']);
    expect(container.querySelector('[data-split="main-horizontal-ai-agentic"]')).toBeTruthy();
    expect(getSplitProps('main-horizontal-ai-agentic')).toEqual({ initialResizeOnMount: 'false' });
    expect(getSplitChildIds('main-horizontal-ai-agentic')).toEqual(['AI-Chat', 'main-horizontal-agentic']);
    expect(getSplitChildIds('main-horizontal-agentic')).toEqual(['main-vertical-agentic', 'view']);
  });

  it('Given agentic layout, when it renders by default, then AI chat and the workbench are both visible', async () => {
    panelLayoutMode = 'agentic';
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlots()).toEqual(['top', 'AI-Chat', 'main', 'panel', 'view', 'statusBar']);
    expect(getSplitChildIds('main-horizontal-ai-agentic')).toEqual(['AI-Chat', 'main-horizontal-agentic']);
    expect(getSplitChildIds('main-horizontal-agentic')).toEqual(['main-vertical-agentic', 'view']);
  });

  it('Given agentic workbench is collapsed, when it becomes visible, then the editor and Explorer return', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = false;
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSplitChildIds('main-horizontal-ai-agentic')).toEqual(['AI-Chat']);

    act(() => {
      agenticWorkbenchVisible = true;
      agenticWorkbenchVisibilityListeners.forEach((listener) => listener(true));
    });

    expect(getSplitChildIds('main-horizontal-ai-agentic')).toEqual(['AI-Chat', 'main-horizontal-agentic']);
    expect(getSplitChildIds('main-horizontal-agentic')).toEqual(['main-vertical-agentic', 'view']);
  });

  it('在窄桌面视口渲染 Agentic Layout 时，应临时折叠工作台并在宽度恢复后重新显示', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    window.innerWidth = 1280;
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    await act(async () => {
      root.render(<AILayout />);
      await Promise.resolve();
    });

    expect(getSplitChildIds('main-horizontal-ai-agentic')).toEqual(['AI-Chat']);

    await act(async () => {
      window.innerWidth = 1366;
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
    });

    expect(getSplitChildIds('main-horizontal-ai-agentic')).toEqual(['AI-Chat', 'main-horizontal-agentic']);
  });

  it('Given agentic layout, when dragging the AI split handle, then the workbench is the flex-grow resize target', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSplitChildProps('main-horizontal-ai-agentic')).toEqual([
      { id: 'AI-Chat', flex: null, flexGrow: null, minResize: '640', minSize: '0', maxResize: '1440' },
      { id: 'main-horizontal-agentic', flex: null, flexGrow: '1', minResize: '640', minSize: null, maxResize: null },
    ]);
  });

  it('Given agentic layout, when the workbench renders, then editor stays left of Explorer with a minimum size', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSplitChildProps('main-horizontal-agentic')).toEqual([
      { id: 'main-vertical-agentic', flex: null, flexGrow: '1', minResize: '360', minSize: '360', maxResize: null },
      { id: 'view', flex: null, flexGrow: null, minResize: '280', minSize: '49', maxResize: '480' },
    ]);
  });

  it('Given agentic layout has no AI chat cache, when it renders, then AI chat opens with the agentic default size', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('view')).toEqual({ defaultSize: '49', maxResize: '480', minResize: '280', minSize: '49' });
    expect(container.querySelector('[data-slot="extendView"]')).toBeFalsy();
    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '840',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });

  it('Given agentic layout has oversized side slot cache, when it renders, then Explorer is capped and extend view is omitted', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    storedLayout = {
      view: {
        currentId: 'explorer',
        size: 960,
      },
      extendView: {
        currentId: 'right',
        size: 720,
      },
    };
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('view')).toEqual({ defaultSize: '480', maxResize: '480', minResize: '280', minSize: '49' });
    expect(container.querySelector('[data-slot="extendView"]')).toBeFalsy();
  });

  it('Given agentic layout has cached collapsed AI chat, when it renders, then AI chat opens with the agentic default size', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    storedLayout = {
      'AI-Chat': {
        currentId: '',
        size: 750,
      },
    };
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '840',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });

  it('Given agentic layout has cached active AI chat, when it renders, then AI chat restores the cached size', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    storedLayout = {
      'AI-Chat': {
        currentId: 'AI-Chat-Container',
        size: 640,
      },
    };
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '640',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });

  it('Given agentic layout has cached active AI chat without size, when it renders, then AI chat falls back to the agentic default size', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    storedLayout = {
      'AI-Chat': {
        currentId: 'AI-Chat-Container',
      },
    };
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '840',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });

  it('Given each panel layout has its own cache, when agentic renders, then it uses the agentic layout cache', async () => {
    panelLayoutMode = 'agentic';
    agenticWorkbenchVisible = true;
    storedLayouts = {
      layout: {
        'AI-Chat': {
          currentId: 'AI-Chat-Container',
          size: 360,
        },
      },
      'layout.ai.agentic': {
        'AI-Chat': {
          currentId: 'AI-Chat-Container',
          size: 1080,
        },
      },
    };
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '1080',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });

  it('Given each panel layout has its own cache, when classic renders, then it uses the classic layout cache', async () => {
    panelLayoutMode = 'classic';
    storedLayouts = {
      layout: {
        'AI-Chat': {
          currentId: 'AI-Chat-Container',
          size: 360,
        },
      },
      'layout.ai.agentic': {
        'AI-Chat': {
          currentId: 'AI-Chat-Container',
          size: 1080,
        },
      },
    };
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '360',
      maxResize: '1080',
      minResize: '280',
      minSize: '0',
    });
  });

  it('Given each panel layout has its own cache, when the direct shells render, then each shell uses its own cache', async () => {
    storedLayouts = {
      layout: {
        'AI-Chat': {
          currentId: 'AI-Chat-Container',
          size: 360,
        },
      },
      'layout.ai.agentic': {
        'AI-Chat': {
          currentId: 'AI-Chat-Container',
          size: 1080,
        },
      },
    };
    const { AgenticShell, ClassicShell } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<ClassicShell />);
    });

    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '360',
      maxResize: '1080',
      minResize: '280',
      minSize: '0',
    });

    act(() => {
      root.render(<AgenticShell />);
    });

    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '1080',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });
});
