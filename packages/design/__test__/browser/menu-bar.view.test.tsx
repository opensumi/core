import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { Simulate, act } from 'react-dom/test-utils';

const mockExecuteCommand = jest.fn();
const mockGetCommand = jest.fn();
const mockCurrentContainerIdGet = jest.fn(() => 'explorer');
const mockOnCurrentChange = jest.fn(() => ({ dispose: jest.fn() }));
const mockGetContextKeyValue = jest.fn();
const mockOnDidChangeContext = jest.fn();

const mockCommandServiceToken = Symbol('CommandService');
const mockCommandRegistryToken = Symbol('CommandRegistry');
const mockMainLayoutServiceToken = Symbol('IMainLayoutService');
const mockContextKeyServiceToken = Symbol('IContextKeyService');

jest.mock('@opensumi/ide-core-common', () => ({
  CommandService: mockCommandServiceToken,
  CommandRegistry: mockCommandRegistryToken,
}));

jest.mock('@opensumi/ide-core-browser', () => {
  const React = require('react');
  return {
    AINativeConfigService: class AINativeConfigService {},
    IContextKeyService: mockContextKeyServiceToken,
    SlotLocation: {
      view: 'view',
    },
    SlotRenderer: ({ id, slot }: { id?: string; slot: string }) =>
      React.createElement('div', {
        id,
        'data-slot': slot,
      }),
    getIcon: (icon: string) => `kticon-${icon}`,
    useInjectable: (token: any) => {
      if (token === mockCommandServiceToken) {
        return {
          executeCommand: mockExecuteCommand,
        };
      }
      if (token === mockCommandRegistryToken) {
        return {
          getCommand: mockGetCommand,
        };
      }
      if (token === mockMainLayoutServiceToken) {
        return {
          getTabbarService: () => ({
            currentContainerId: {
              get: mockCurrentContainerIdGet,
            },
            onCurrentChange: mockOnCurrentChange,
          }),
        };
      }
      if (token === mockContextKeyServiceToken) {
        return {
          getContextKeyValue: mockGetContextKeyValue,
          onDidChangeContext: mockOnDidChangeContext,
        };
      }
      if (token?.name === 'AINativeConfigService') {
        return {
          layoutViewSize: {
            menubarHeight: 32,
          },
        };
      }
      if (token?.name === 'DesignLayoutConfig') {
        return {
          menubarLogo: '',
        };
      }
      if (token?.name === 'AbstractContextMenuService') {
        return {
          createMenu: () => ({
            getMergedMenuNodes: () => [],
            dispose: jest.fn(),
          }),
        };
      }
      if (token?.name === 'ICtxMenuRenderer') {
        return {
          show: jest.fn(),
        };
      }
      return {};
    },
  };
});

jest.mock('@opensumi/ide-core-browser/lib/components', () => {
  const React = require('react');
  return {
    Icon: ({ className }: { className?: string }) => React.createElement('span', { className }),
  };
});

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => {
  const React = require('react');
  return {
    EnhanceIcon: React.forwardRef(({ icon, onClick, children, wrapperClassName }: any, ref: any) =>
      React.createElement(
        'div',
        {
          ref,
          className: wrapperClassName,
          'data-testid': icon ? 'left-panel-toggle' : 'menu-logo',
          'data-icon': icon,
          onClick,
        },
        children,
      ),
    ),
  };
});

jest.mock('@opensumi/ide-core-browser/lib/layout/constants', () => ({
  DesignLayoutConfig: class DesignLayoutConfig {},
}));

jest.mock('@opensumi/ide-core-browser/lib/layout/view-id', () => ({
  VIEW_CONTAINERS: {
    MENUBAR: 'menubar',
  },
}));

jest.mock('@opensumi/ide-core-browser/lib/menu/next', () => ({
  AbstractContextMenuService: class AbstractContextMenuService {},
  ICtxMenuRenderer: class ICtxMenuRenderer {},
  MenuId: {
    DesignMenuBarTopExtra: 'DesignMenuBarTopExtra',
  },
}));

jest.mock('@opensumi/ide-main-layout', () => ({
  IMainLayoutService: mockMainLayoutServiceToken,
}));

jest.mock('@opensumi/ide-toolbar/lib/browser/toolbar.view', () => ({
  ToolBar: () => <div data-testid='toolbar' />,
}));

jest.mock('../../src/browser/menu-bar/logo.svg', () => 'logo.svg');

jest.mock('../../src/browser/menu-bar/menu-bar.module.less', () => ({
  ai_enhance_menu: 'ai_enhance_menu',
  caret_icon: 'caret_icon',
  container: 'container',
  dividing: 'dividing',
  enhance_menu: 'enhance_menu',
  extra_top_icon: 'extra_top_icon',
  left: 'left',
  logo_container: 'logo_container',
  menu_bar_view: 'menu_bar_view',
  right: 'right',
  top_menus_bar: 'top_menus_bar',
}));

describe('DesignMenuBarView', () => {
  let container: HTMLDivElement;
  let root: Root;
  let agenticWorkbenchVisible = true;
  let panelLayoutMode: 'classic' | 'agentic' | undefined = 'classic';
  let contextChangeListeners: Array<(event: { payload: { affectsSome: (keys: Set<string>) => boolean } }) => void>;
  let originalRequestAnimationFrame: typeof requestAnimationFrame;

  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    agenticWorkbenchVisible = true;
    panelLayoutMode = 'classic';
    contextChangeListeners = [];
    mockGetContextKeyValue.mockImplementation((key: string) =>
      key === 'aiNative.panelLayout' ? panelLayoutMode : undefined,
    );
    mockOnDidChangeContext.mockImplementation((listener) => {
      contextChangeListeners.push(listener);
      return {
        dispose: jest.fn(() => {
          contextChangeListeners = contextChangeListeners.filter((item) => item !== listener);
        }),
      };
    });
    mockCurrentContainerIdGet.mockReturnValue('explorer');
    mockGetCommand.mockImplementation((id: string) =>
      id === 'ai-native.agentic-workbench.toggle' || id === 'ai-native.agentic-workbench.is-visible'
        ? { id }
        : undefined,
    );
    mockExecuteCommand.mockImplementation((id: string) => {
      if (id === 'ai-native.agentic-workbench.is-visible') {
        return Promise.resolve(agenticWorkbenchVisible);
      }
      if (id === 'ai-native.agentic-workbench.toggle') {
        agenticWorkbenchVisible = !agenticWorkbenchVisible;
        return Promise.resolve(agenticWorkbenchVisible);
      }
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.requestAnimationFrame = originalRequestAnimationFrame;
    jest.clearAllMocks();
  });

  async function renderMenuBar(): Promise<void> {
    const { DesignMenuBarView } = await import('../../src/browser/menu-bar/menu-bar.view');

    await act(async () => {
      root.render(<DesignMenuBarView />);
      await flushPromises();
    });
  }

  const getToggle = () => container.querySelector<HTMLElement>('[data-testid="left-panel-toggle"]')!;
  const getLogo = () => container.querySelector<HTMLElement>('[data-testid="menu-logo"]')!;
  const getTopMenusBar = () => container.querySelector<HTMLElement>('.top_menus_bar')!;

  const emitPanelLayoutChange = async (mode: 'classic' | 'agentic') => {
    panelLayoutMode = mode;

    await act(async () => {
      contextChangeListeners.forEach((listener) =>
        listener({
          payload: {
            affectsSome: (keys: Set<string>) => keys.has('aiNative.panelLayout'),
          },
        }),
      );
      await flushPromises();
    });
  };

  it('renders the top menus and panel toggle in the left group for classic layout', async () => {
    await renderMenuBar();

    const left = container.querySelector<HTMLElement>('.left')!;
    const right = container.querySelector<HTMLElement>('.right')!;
    const leftSlot = left.querySelector<HTMLElement>('#design-menubar-left')!;
    const toggle = getToggle();
    const divider = left.querySelector<HTMLElement>('.dividing')!;
    const topMenusBar = getTopMenusBar();

    expect(left.contains(toggle)).toBeTruthy();
    expect(left.contains(topMenusBar)).toBeTruthy();
    expect(right.contains(toggle)).toBeFalsy();
    expect(right.contains(topMenusBar)).toBeFalsy();
    expect(toggle.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(divider.compareDocumentPosition(topMenusBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(topMenusBar.compareDocumentPosition(leftSlot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the top menus and panel toggle in the right group for agentic layout', async () => {
    panelLayoutMode = 'agentic';

    await renderMenuBar();

    const left = container.querySelector<HTMLElement>('.left')!;
    const right = container.querySelector<HTMLElement>('.right')!;
    const rightSlot = right.querySelector<HTMLElement>('#design-menubar-right')!;
    const topMenusBar = getTopMenusBar();
    const toggle = getToggle();

    expect(left.contains(topMenusBar)).toBeFalsy();
    expect(left.contains(toggle)).toBeFalsy();
    expect(right.contains(topMenusBar)).toBeTruthy();
    expect(right.contains(toggle)).toBeTruthy();
    expect(rightSlot.compareDocumentPosition(topMenusBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(topMenusBar.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('repositions the top menus and panel toggle when the panel layout changes', async () => {
    await renderMenuBar();

    expect(container.querySelector('.left .top_menus_bar')).not.toBeNull();
    expect(container.querySelector('.right .top_menus_bar')).toBeNull();

    await emitPanelLayoutChange('agentic');

    expect(container.querySelector('.left .top_menus_bar')).toBeNull();
    expect(container.querySelector('.right .top_menus_bar')).not.toBeNull();
  });

  it('uses the agentic workbench command and returned visibility for the top toggle', async () => {
    await renderMenuBar();

    expect(getToggle().getAttribute('data-icon')).toBe('left-nav-open');

    await act(async () => {
      Simulate.click(getToggle());
      await flushPromises();
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith('ai-native.agentic-workbench.toggle');
    expect(mockExecuteCommand).not.toHaveBeenCalledWith('main-layout.left-panel.toggle');
    expect(getToggle().getAttribute('data-icon')).toBe('left-nav-close');

    await act(async () => {
      Simulate.click(getToggle());
      await flushPromises();
    });

    expect(getToggle().getAttribute('data-icon')).toBe('left-nav-open');
  });

  it('falls back to the left panel command when the agentic command is unavailable', async () => {
    mockGetCommand.mockReturnValue(undefined);

    await renderMenuBar();

    await act(async () => {
      Simulate.click(getToggle());
      await flushPromises();
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith('main-layout.left-panel.toggle');
    expect(mockExecuteCommand).not.toHaveBeenCalledWith('ai-native.agentic-workbench.toggle');
  });

  it('falls back to the left panel command when the agentic command returns undefined', async () => {
    mockExecuteCommand.mockImplementation((id: string) => {
      if (id === 'ai-native.agentic-workbench.is-visible' || id === 'ai-native.agentic-workbench.toggle') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(undefined);
    });

    await renderMenuBar();

    expect(getToggle().getAttribute('data-icon')).toBe('left-nav-open');

    await act(async () => {
      Simulate.click(getToggle());
      await flushPromises();
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith('ai-native.agentic-workbench.toggle');
    expect(mockExecuteCommand).toHaveBeenCalledWith('main-layout.left-panel.toggle');
  });
});
