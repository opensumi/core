import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

let mockEventBus: ReturnType<typeof createMockEventBus>;
let mockSplitPanelManager: ReturnType<typeof createMockSplitPanelManager>;

jest.mock('../../../src/react-hooks', () => ({
  useInjectable: (token: any) => {
    if (token?.name === 'SplitPanelManager') {
      return mockSplitPanelManager;
    }

    return mockEventBus;
  },
}));

import { PanelContext, ResizeHandle, SplitPanel } from '../../../src/components/layout/split-panel';

function createMockEventBus() {
  const directiveListeners = new Map<string, Set<() => void>>();

  return {
    fire: jest.fn(),
    fireDirective: jest.fn((directive: string) => {
      directiveListeners.get(directive)?.forEach((listener) => listener());
    }),
    onDirective: jest.fn((directive: string, listener: () => void) => {
      let listeners = directiveListeners.get(directive);
      if (!listeners) {
        listeners = new Set();
        directiveListeners.set(directive, listeners);
      }
      listeners.add(listener);

      return {
        dispose: () => {
          listeners?.delete(listener);
        },
      };
    }),
  };
}

function createMockSplitPanelService() {
  return {
    panels: [] as HTMLElement[],
    getFirstResizablePanel: jest.fn(),
    interceptProps: (props: any) => props,
    renderSplitPanel: (component: React.JSX.Element, children: React.ReactNode[]) =>
      React.cloneElement(component, component.props, children),
    setRootNode: jest.fn(),
  };
}

function createMockSplitPanelManager() {
  const services = new Map<string, ReturnType<typeof createMockSplitPanelService>>();

  return {
    getService: jest.fn((panelId: string) => {
      let service = services.get(panelId);
      if (!service) {
        service = createMockSplitPanelService();
        services.set(panelId, service);
      }

      return service;
    }),
  };
}

describe('SplitPanel initialResizeOnMount', () => {
  let container: HTMLDivElement;
  let root: Root;
  let animationFrameCallbacks: FrameRequestCallback[];
  let originalRequestAnimationFrame: typeof global.requestAnimationFrame;
  let originalCancelAnimationFrame: typeof global.cancelAnimationFrame;

  const render = (node: React.ReactNode) => {
    act(() => {
      root.render(node);
    });
  };

  const flushAnimationFrame = () => {
    const callbacks = animationFrameCallbacks;
    animationFrameCallbacks = [];
    act(() => {
      callbacks.forEach((callback) => callback(0));
    });
  };

  const getResizeLocations = () => mockEventBus.fire.mock.calls.map(([event]) => event.payload.slotLocation);
  const setReadonlySize = (element: Element, name: 'offsetWidth' | 'clientWidth', value: number) => {
    Object.defineProperty(element, name, {
      configurable: true,
      value,
    });
  };

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    mockSplitPanelManager = createMockSplitPanelManager();
    animationFrameCallbacks = [];
    originalRequestAnimationFrame = global.requestAnimationFrame;
    originalCancelAnimationFrame = global.cancelAnimationFrame;
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    }) as typeof global.requestAnimationFrame;
    global.cancelAnimationFrame = jest.fn() as typeof global.cancelAnimationFrame;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('does not emit initial resize by default', () => {
    render(
      <SplitPanel id='root'>
        <div data-sp-slot='left' />
        <div data-sp-id='right' />
      </SplitPanel>,
    );

    flushAnimationFrame();

    expect(mockEventBus.fire).not.toHaveBeenCalled();
    expect(mockEventBus.fireDirective).not.toHaveBeenCalled();
  });

  it('emits initial resize for direct children when opted in', () => {
    render(
      <SplitPanel id='root' initialResizeOnMount>
        <div data-sp-slot='left' />
        <div data-sp-id='right' />
      </SplitPanel>,
    );

    flushAnimationFrame();

    expect(getResizeLocations()).toEqual(['left', 'right']);
    expect(mockEventBus.fireDirective.mock.calls.map(([directive]) => directive)).toEqual([
      'resize:left',
      'resize:right',
    ]);
  });

  it('cascades initial resize through nested split panels', () => {
    render(
      <SplitPanel id='root' initialResizeOnMount>
        <SplitPanel id='nested'>
          <div data-sp-slot='nested-main' />
          <div data-sp-id='nested-side' />
        </SplitPanel>
        <div data-sp-slot='right' />
      </SplitPanel>,
    );

    flushAnimationFrame();

    expect(getResizeLocations()).toEqual(['nested', 'nested-main', 'nested-side', 'right']);
    expect(mockEventBus.fireDirective.mock.calls.map(([directive]) => directive)).toEqual([
      'resize:nested',
      'resize:nested-main',
      'resize:nested-side',
      'resize:right',
    ]);
  });

  it('cancels pending initial resize on unmount', () => {
    render(
      <SplitPanel id='root' initialResizeOnMount>
        <div data-sp-slot='left' />
        <div data-sp-id='right' />
      </SplitPanel>,
    );

    render(null);
    flushAnimationFrame();

    expect(mockEventBus.fire).not.toHaveBeenCalled();
    expect(mockEventBus.fireDirective).not.toHaveBeenCalled();
  });

  it('updates resize delegates when children switch order', () => {
    const resizeHandles: Record<string, ResizeHandle> = {};
    const CapturePanel = ({ name }: { id: string; name: string; flexGrow?: number }) => {
      resizeHandles[name] = React.useContext(PanelContext);
      return <div data-panel={name} />;
    };

    render(
      <SplitPanel id='root' direction='left-to-right'>
        <CapturePanel id='workbench' name='workbench' flexGrow={1} />
        <CapturePanel id='chat' name='chat' />
      </SplitPanel>,
    );

    render(
      <SplitPanel id='root' direction='left-to-right'>
        <CapturePanel id='chat' name='chat' />
        <CapturePanel id='workbench' name='workbench' flexGrow={1} />
      </SplitPanel>,
    );

    const rootNode = container.querySelector('#root')!;
    const chatWrapper = rootNode.children[0] as HTMLElement;
    const workbenchWrapper = rootNode.children[2] as HTMLElement;
    setReadonlySize(rootNode, 'offsetWidth', 1000);
    setReadonlySize(chatWrapper, 'clientWidth', 0);
    setReadonlySize(workbenchWrapper, 'clientWidth', 0);

    act(() => {
      resizeHandles.chat.setSize(0);
    });
    flushAnimationFrame();

    expect(chatWrapper.style.flexGrow).toBe('0');
    expect(chatWrapper.classList.contains('kt_display_none')).toBe(true);
    expect(workbenchWrapper.style.flexGrow).toBe('1');
    expect(workbenchWrapper.classList.contains('kt_display_none')).toBe(false);

    act(() => {
      resizeHandles.chat.setSize(300);
    });
    flushAnimationFrame();

    expect(chatWrapper.style.width).toBe('300px');
    expect(chatWrapper.classList.contains('kt_display_none')).toBe(false);
    expect(workbenchWrapper.classList.contains('kt_display_none')).toBe(false);
  });

  it('restores the first child when resize is requested from the latter side', () => {
    const resizeHandles: Record<string, ResizeHandle> = {};
    const CapturePanel = ({ name }: { id: string; name: string; flexGrow?: number }) => {
      resizeHandles[name] = React.useContext(PanelContext);
      return <div data-panel={name} />;
    };

    render(
      <SplitPanel id='root' direction='left-to-right'>
        <CapturePanel id='chat' name='chat' />
        <CapturePanel id='workbench' name='workbench' flexGrow={1} />
      </SplitPanel>,
    );

    const rootNode = container.querySelector('#root')!;
    const chatWrapper = rootNode.children[0] as HTMLElement;
    const workbenchWrapper = rootNode.children[2] as HTMLElement;
    setReadonlySize(rootNode, 'offsetWidth', 1000);
    setReadonlySize(chatWrapper, 'clientWidth', 0);
    setReadonlySize(workbenchWrapper, 'clientWidth', 0);

    act(() => {
      resizeHandles.chat.setSize(0);
    });
    flushAnimationFrame();

    expect(chatWrapper.classList.contains('kt_display_none')).toBe(true);

    act(() => {
      resizeHandles.chat.setSize(320, true);
    });
    flushAnimationFrame();

    expect(chatWrapper.style.width).toBe('320px');
    expect(chatWrapper.classList.contains('kt_display_none')).toBe(false);
    expect(workbenchWrapper.classList.contains('kt_display_none')).toBe(false);
  });
});
