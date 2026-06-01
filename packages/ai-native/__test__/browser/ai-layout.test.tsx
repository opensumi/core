import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

let panelLayoutMode: 'classic' | 'agentic' = 'classic';

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
    SlotRenderer: ({ slot, id }: { slot: string; id?: string }) =>
      React.createElement('div', {
        'data-slot': slot,
        'data-id': id,
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
      return {};
    },
  };
});

jest.mock('@opensumi/ide-core-browser/lib/components', () => {
  const React = require('react');
  return {
    BoxPanel: ({ children }: React.PropsWithChildren) => React.createElement('div', { 'data-box': true }, children),
    SplitPanel: ({ id, children }: React.PropsWithChildren<{ id: string }>) =>
      React.createElement(
        'div',
        { 'data-split': id },
        React.Children.toArray(children).map((child: React.ReactElement, index: number) =>
          React.createElement(
            'div',
            {
              key: index,
              'data-resize-child': true,
              'data-child-id': child?.props?.id,
              'data-child-slot': child?.props?.slot,
            },
            child,
          ),
        ),
      ),
    getStorageValue: () => ({ layout: {} }),
  };
});

jest.mock('@opensumi/ide-core-browser/lib/layout/constants', () => ({
  DesignLayoutConfig: class DesignLayoutConfig {},
}));

jest.mock('../../src/browser/layout/panel-layout.service', () => ({
  AIPanelLayoutService: class AIPanelLayoutService {},
}));

describe('AILayout', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalUserAgent: string;

  const getSlots = () =>
    Array.from(container.querySelectorAll('[data-slot]')).map((node) => node.getAttribute('data-slot'));
  const getSplitChildIds = (id: string) =>
    Array.from(container.querySelectorAll(`[data-split="${id}"] > [data-resize-child]`)).map(
      (node) => node.getAttribute('data-child-id') || node.getAttribute('data-child-slot'),
    );

  beforeEach(() => {
    originalUserAgent = window.navigator.userAgent;
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0',
      configurable: true,
    });
    panelLayoutMode = 'classic';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('should render AI chat after the workbench in classic layout', async () => {
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlots()).toEqual(['top', 'view', 'main', 'panel', 'extendView', 'AI-Chat', 'statusBar']);
    expect(container.querySelector('[data-split="main-horizontal-ai"]')).toBeTruthy();
    expect(getSplitChildIds('main-horizontal-ai')).toEqual(['main-horizontal', 'AI-Chat']);
    expect(getSplitChildIds('main-horizontal')).toEqual(['view', 'main-vertical', 'extendView']);
  });

  it('should render AI chat before the workbench in agentic layout', async () => {
    panelLayoutMode = 'agentic';
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlots()).toEqual(['top', 'AI-Chat', 'main', 'panel', 'view', 'extendView', 'statusBar']);
    expect(container.querySelector('[data-split="main-horizontal-ai-agentic"]')).toBeTruthy();
    expect(getSplitChildIds('main-horizontal-ai-agentic')).toEqual(['AI-Chat', 'main-horizontal-agentic']);
    expect(getSplitChildIds('main-horizontal-agentic')).toEqual(['main-vertical-agentic', 'view', 'extendView']);
  });

  it('should keep the mobile layout chat-only', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'iPhone',
      configurable: true,
    });
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSlots()).toEqual(['AI-Chat']);
  });
});
