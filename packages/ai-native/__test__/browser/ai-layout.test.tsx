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
              'data-child-flex': child?.props?.flex,
              'data-child-flex-grow': child?.props?.flexGrow,
              'data-child-min-resize': child?.props?.minResize,
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
    }));

  beforeEach(() => {
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

  it('Given agentic layout, when it renders, then AI chat is before the workbench', async () => {
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

  it('Given agentic layout, when dragging the AI split handle, then the workbench is the flex-grow resize target', async () => {
    panelLayoutMode = 'agentic';
    const { AILayout } = await import('../../src/browser/layout/ai-layout');

    act(() => {
      root.render(<AILayout />);
    });

    expect(getSplitChildProps('main-horizontal-ai-agentic')).toEqual([
      { id: 'AI-Chat', flex: null, flexGrow: null, minResize: '280' },
      { id: 'main-horizontal-agentic', flex: null, flexGrow: '1', minResize: '300' },
    ]);
  });
});
