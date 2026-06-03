import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

let panelLayoutMode: 'classic' | 'agentic' = 'classic';
let storedLayout: Record<string, { currentId?: string; size?: number }> = {};
let storedLayouts: Record<string, Record<string, { currentId?: string; size?: number }>> = {};
const mockToggleSlot = jest.fn();

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
          onDidChangePanelLayout: () => ({ dispose: jest.fn() }),
        };
      }
      if (String(token) === 'Symbol(CLIENT_APP_TOKEN)') {
        return {
          appInitialized: {
            promise: new Promise(() => {}),
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
  getAIChatDefaultSize: (mode: 'classic' | 'agentic') => (mode === 'agentic' ? 1080 : 480),
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
      { id: 'main-horizontal', flex: null, flexGrow: '1', minResize: '300', maxResize: null },
      { id: 'AI-Chat', flex: null, flexGrow: null, minResize: '280', maxResize: '1080' },
    ]);
  });

  it('Given classic layout has no cached active containers, when it renders, then side slots keep their collapsed defaults', async () => {
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('view')).toEqual({ defaultSize: '49', maxResize: null, minResize: '280', minSize: '49' });
    expect(getSlotProps('extendView')).toEqual({ defaultSize: '49', maxResize: null, minResize: '280', minSize: '49' });
    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '0',
      maxResize: '1080',
      minResize: '280',
      minSize: '0',
    });
  });

  it('Given agentic layout, when it renders, then AI chat is before the workbench', async () => {
    panelLayoutMode = 'agentic';
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlots()).toEqual(['top', 'AI-Chat', 'main', 'panel', 'view', 'extendView', 'statusBar']);
    expect(container.querySelector('[data-split="main-horizontal-ai-agentic"]')).toBeTruthy();
    expect(getSplitProps('main-horizontal-ai-agentic')).toEqual({ initialResizeOnMount: 'true' });
    expect(getSplitChildIds('main-horizontal-ai-agentic')).toEqual(['AI-Chat', 'main-horizontal-agentic']);
    expect(getSplitChildIds('main-horizontal-agentic')).toEqual(['main-vertical-agentic', 'view', 'extendView']);
  });

  it('Given agentic layout, when dragging the AI split handle, then the workbench is the flex-grow resize target', async () => {
    panelLayoutMode = 'agentic';
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSplitChildProps('main-horizontal-ai-agentic')).toEqual([
      { id: 'AI-Chat', flex: null, flexGrow: null, minResize: '640', maxResize: '1440' },
      { id: 'main-horizontal-agentic', flex: null, flexGrow: '1', minResize: '480', maxResize: null },
    ]);
  });

  it('Given agentic layout has no AI chat cache, when it renders, then AI chat opens with the agentic default size', async () => {
    panelLayoutMode = 'agentic';
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlotProps('view')).toEqual({ defaultSize: '49', maxResize: null, minResize: '280', minSize: '49' });
    expect(getSlotProps('extendView')).toEqual({ defaultSize: '49', maxResize: null, minResize: '280', minSize: '49' });
    expect(getSlotProps('AI-Chat')).toEqual({
      defaultSize: '1080',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });

  it('Given agentic layout has cached collapsed AI chat, when it renders, then AI chat stays collapsed', async () => {
    panelLayoutMode = 'agentic';
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
      defaultSize: '0',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });

  it('Given agentic layout has cached active AI chat, when it renders, then AI chat restores the cached size', async () => {
    panelLayoutMode = 'agentic';
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
      defaultSize: '1080',
      maxResize: '1440',
      minResize: '640',
      minSize: '0',
    });
  });

  it('Given each panel layout has its own cache, when agentic renders, then it uses the agentic layout cache', async () => {
    panelLayoutMode = 'agentic';
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
});
