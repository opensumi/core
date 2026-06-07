import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

let panelLayoutMode: 'classic' | 'agentic' = 'classic';
let mockCapturedDesignLeftProps: any;
let mockCapturedTabRendererProps: any;
let mockCapturedLeftTabbarProps: any;
let mockCapturedTabbarViewBaseProps: any;
let mockCapturedResizeHandle: any;
let mockViewCurrentContainerId = 'view-current';
let mockExtendViewCurrentContainerId = 'extend-view-current';
let mockViewReadyPromise: Promise<void> = Promise.resolve();

const mockMainLayoutServiceToken = Symbol('IMainLayoutService');
const mockTabbarServiceFactoryToken = Symbol('TabbarServiceFactory');
const mockViewTabbarService = {
  currentContainerId: {
    get: jest.fn(() => mockViewCurrentContainerId),
  },
  visibleContainers: [] as any[],
  prevSize: undefined as number | undefined,
  viewReady: {
    get promise() {
      return mockViewReadyPromise;
    },
  },
};
const mockExtendViewTabbarService = {
  currentContainerId: {
    get: jest.fn(() => mockExtendViewCurrentContainerId),
  },
  visibleContainers: [] as any[],
};
const mockTabbarServices = {
  view: mockViewTabbarService,
  extendView: mockExtendViewTabbarService,
};
const mockTabbarServiceFactory = jest.fn((side: keyof typeof mockTabbarServices) => mockTabbarServices[side]);

jest.mock('@opensumi/ide-core-browser', () => ({
  SlotLocation: {
    view: 'view',
    extendView: 'extendView',
  },
  fastdom: {
    measureAtNextFrame: (callback: () => void) => {
      callback();
      return { dispose: jest.fn() };
    },
  },
  useAutorun: (value: any) => (typeof value?.get === 'function' ? value.get() : value),
  useContextMenus: () => [[]],
  useInjectable: (token: any) => {
    if (token?.name === 'AIPanelLayoutService') {
      return {
        getLayoutMode: () => panelLayoutMode,
      };
    }
    if (token === mockMainLayoutServiceToken) {
      return {
        getExtraMenu: () => [],
        getExtraTopMenu: () => [],
      };
    }
    if (token === mockTabbarServiceFactoryToken) {
      return mockTabbarServiceFactory;
    }
    return {};
  },
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => {
  const React = require('react');
  return {
    EDirection: {
      LeftToRight: 'left-to-right',
      RightToLeft: 'right-to-left',
    },
    PanelContext: React.createContext({
      setSize: jest.fn(),
      setRelativeSize: jest.fn(),
      getSize: jest.fn(),
      getRelativeSize: jest.fn(),
      lockSize: jest.fn(),
      setMaxSize: jest.fn(),
      hidePanel: jest.fn(),
    }),
  };
});

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: () => <span />,
  EnhanceIconWithCtxMenu: () => <span />,
  EnhancePopover: ({ children }: React.PropsWithChildren) => <>{children}</>,
  HorizontalVertical: () => <span />,
}));

jest.mock('@opensumi/ide-core-browser/lib/layout/constants', () => ({
  DesignLayoutConfig: class DesignLayoutConfig {},
}));

jest.mock('@opensumi/ide-core-browser/lib/layout/view-id', () => ({
  VIEW_CONTAINERS: {
    LEFT_TABBAR_PANEL: 'left-tabbar-panel',
  },
}));

jest.mock('@opensumi/ide-core-common', () => ({
  localize: (key: string) => key,
}));

jest.mock('@opensumi/ide-design/lib/browser/layout/tabbar.view', () => ({
  DesignLeftTabRenderer: (props: any) => {
    mockCapturedDesignLeftProps = props;
    return <div data-testid='design-left-tab-renderer' />;
  },
  DesignRightTabRenderer: () => <div />,
}));

jest.mock('@opensumi/ide-main-layout', () => ({
  IMainLayoutService: mockMainLayoutServiceToken,
}));

jest.mock('@opensumi/ide-main-layout/lib/browser/tabbar/bar.view', () => ({
  ChatTabbarRenderer2: () => <div />,
  IconElipses: () => <div />,
  IconTabView: () => <div />,
  LeftTabbarRenderer: (props: any) => {
    mockCapturedLeftTabbarProps = props;
    return <div data-testid='left-tabbar-renderer' />;
  },
  RightTabbarRenderer: () => <div />,
  TabbarViewBase: (props: any) => {
    mockCapturedTabbarViewBaseProps = props;
    return <div data-testid='tabbar-view-base' />;
  },
}));

jest.mock('@opensumi/ide-main-layout/lib/browser/tabbar/panel.view', () => ({
  BaseTabPanelView: () => <div data-testid='base-tab-panel-view' />,
  ContainerView: () => <div />,
}));

jest.mock('@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view', () => ({
  TabRendererBase: (props: any) => {
    const React = require('react');
    const { PanelContext } = require('@opensumi/ide-core-browser/lib/components');
    mockCapturedTabRendererProps = props;
    mockCapturedResizeHandle = React.useContext(PanelContext);
    const TabbarView = props.TabbarView;
    const TabpanelView = props.TabpanelView;
    return (
      <div data-testid='tab-renderer-base' data-direction={props.direction} className={props.className}>
        <TabbarView />
        <TabpanelView />
      </div>
    );
  },
}));

jest.mock('@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service', () => ({
  TabbarServiceFactory: mockTabbarServiceFactoryToken,
}));

jest.mock('../../src/browser/layout/panel-layout.service', () => ({
  AIPanelLayoutService: class AIPanelLayoutService {},
}));

describe('AI tabbar layout BDD', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    panelLayoutMode = 'classic';
    mockCapturedDesignLeftProps = undefined;
    mockCapturedTabRendererProps = undefined;
    mockCapturedLeftTabbarProps = undefined;
    mockCapturedTabbarViewBaseProps = undefined;
    mockCapturedResizeHandle = undefined;
    mockTabbarServiceFactory.mockClear();
    mockViewCurrentContainerId = 'view-current';
    mockViewReadyPromise = Promise.resolve();
    mockViewTabbarService.visibleContainers = [];
    mockViewTabbarService.prevSize = undefined;
    mockExtendViewCurrentContainerId = 'extend-view-current';
    mockExtendViewTabbarService.visibleContainers = [];
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

  it('Given classic layout, when the left tab renderer renders, then it uses the design left renderer', async () => {
    const { AILeftTabRenderer } = await import('../../src/browser/layout/tabbar.view');

    act(() => {
      root.render(<AILeftTabRenderer className='slot-class' components={[]} />);
    });

    expect(container.querySelector('[data-testid="design-left-tab-renderer"]')).toBeTruthy();
    expect(mockCapturedDesignLeftProps.className).toBe('slot-class');
    expect(mockCapturedDesignLeftProps.tabbarView).toBeTruthy();
    expect(mockCapturedTabRendererProps).toBeUndefined();
  });

  it('Given agentic layout, when the left tab renderer renders, then it puts the view tabbar on the right', async () => {
    panelLayoutMode = 'agentic';
    const { AILeftTabRenderer } = await import('../../src/browser/layout/tabbar.view');

    act(() => {
      root.render(<AILeftTabRenderer className='slot-class' components={[]} />);
    });

    expect(container.querySelector('[data-testid="tab-renderer-base"]')).toBeTruthy();
    expect(mockCapturedTabRendererProps.side).toBe('view');
    expect(mockCapturedTabRendererProps.direction).toBe('right-to-left');
    expect(mockCapturedTabRendererProps.className).toContain('left-slot');
    expect(mockCapturedTabRendererProps.className).toContain('design_left_slot');
    expect(mockCapturedTabRendererProps.className).toContain('agentic_view_slot');
    expect(container.querySelector('.agentic_view_tab_bar')).toBeTruthy();
    expect(mockCapturedLeftTabbarProps).toBeTruthy();
    expect(mockTabbarServiceFactory).toHaveBeenCalledWith('view');
    expect(mockTabbarServiceFactory).toHaveBeenCalledWith('extendView');
  });

  it('Given agentic layout, when rendering merged extra containers, then it uses extendView containers only', async () => {
    panelLayoutMode = 'agentic';
    mockViewTabbarService.visibleContainers = [
      {
        options: {
          containerId: 'view-explorer',
        },
      },
    ];
    mockExtendViewTabbarService.visibleContainers = [
      {
        options: {
          containerId: 'extend-tools',
        },
      },
      {
        options: {
          containerId: 'extend-hidden',
          hideTab: true,
        },
      },
    ];
    const { AILeftTabRenderer } = await import('../../src/browser/layout/tabbar.view');

    act(() => {
      root.render(<AILeftTabRenderer className='slot-class' components={[]} />);
    });

    const renderContainers = jest.fn((component) => <span key={component.options.containerId} />);
    mockCapturedLeftTabbarProps.renderOtherVisibleContainers({ renderContainers });

    expect(renderContainers).toHaveBeenCalledTimes(1);
    expect(renderContainers).toHaveBeenCalledWith(
      mockExtendViewTabbarService.visibleContainers[0],
      mockExtendViewTabbarService,
      'extend-view-current',
    );
    expect(renderContainers).not.toHaveBeenCalledWith(
      mockViewTabbarService.visibleContainers[0],
      expect.anything(),
      expect.anything(),
    );
  });

  it('Given agentic layout, when the view slot restores size, then it uses the previous resize handle', async () => {
    panelLayoutMode = 'agentic';
    const { PanelContext } = await import('@opensumi/ide-core-browser/lib/components');
    const { AILeftTabRenderer } = await import('../../src/browser/layout/tabbar.view');
    const parentResizeHandle = {
      setSize: jest.fn(),
      setRelativeSize: jest.fn(),
      getSize: jest.fn(() => 384),
      getRelativeSize: jest.fn(() => [1, 2]),
      lockSize: jest.fn(),
      setMaxSize: jest.fn(),
      hidePanel: jest.fn(),
    };

    act(() => {
      root.render(
        <PanelContext.Provider value={parentResizeHandle}>
          <AILeftTabRenderer className='slot-class' components={[]} />
        </PanelContext.Provider>,
      );
    });

    mockCapturedResizeHandle.setSize(384, false);
    mockCapturedResizeHandle.setRelativeSize(1, 2, false);
    mockCapturedResizeHandle.getSize(false);
    mockCapturedResizeHandle.getRelativeSize(false);
    mockCapturedResizeHandle.lockSize(true, false);
    mockCapturedResizeHandle.setMaxSize(true, false);

    expect(parentResizeHandle.setSize).toHaveBeenCalledWith(384, true);
    expect(parentResizeHandle.setRelativeSize).toHaveBeenCalledWith(1, 2, true);
    expect(parentResizeHandle.getSize).toHaveBeenCalledWith(true);
    expect(parentResizeHandle.getRelativeSize).toHaveBeenCalledWith(true);
    expect(parentResizeHandle.lockSize).toHaveBeenCalledWith(true, true);
    expect(parentResizeHandle.setMaxSize).toHaveBeenCalledWith(true, true);
  });

  it('Given agentic layout has an active Explorer at activity bar width, when view is ready, then it restores cached width', async () => {
    panelLayoutMode = 'agentic';
    mockViewCurrentContainerId = 'workbench.explorer.fileView';
    mockViewTabbarService.prevSize = 384;
    const { PanelContext } = await import('@opensumi/ide-core-browser/lib/components');
    const { AILeftTabRenderer } = await import('../../src/browser/layout/tabbar.view');
    const parentResizeHandle = {
      setSize: jest.fn(),
      setRelativeSize: jest.fn(),
      getSize: jest.fn(() => 49),
      getRelativeSize: jest.fn(() => [951, 49]),
      lockSize: jest.fn(),
      setMaxSize: jest.fn(),
      hidePanel: jest.fn(),
    };

    await act(async () => {
      root.render(
        <PanelContext.Provider value={parentResizeHandle}>
          <AILeftTabRenderer className='slot-class' components={[]} />
        </PanelContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(parentResizeHandle.getSize).toHaveBeenCalledWith(true);
    expect(parentResizeHandle.setSize).toHaveBeenCalledWith(384, true);
  });

  it('Given agentic layout has an active Explorer without cached width, when view is ready, then it restores the default usable width', async () => {
    panelLayoutMode = 'agentic';
    mockViewCurrentContainerId = 'workbench.explorer.fileView';
    const { PanelContext } = await import('@opensumi/ide-core-browser/lib/components');
    const { AILeftTabRenderer } = await import('../../src/browser/layout/tabbar.view');
    const parentResizeHandle = {
      setSize: jest.fn(),
      setRelativeSize: jest.fn(),
      getSize: jest.fn(() => 49),
      getRelativeSize: jest.fn(() => [951, 49]),
      lockSize: jest.fn(),
      setMaxSize: jest.fn(),
      hidePanel: jest.fn(),
    };

    await act(async () => {
      root.render(
        <PanelContext.Provider value={parentResizeHandle}>
          <AILeftTabRenderer className='slot-class' components={[]} />
        </PanelContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(parentResizeHandle.setSize).toHaveBeenCalledWith(310, true);
  });

  it('Given agentic layout has an active Explorer before view is ready, when it is collapsed, then it restores immediately', async () => {
    panelLayoutMode = 'agentic';
    mockViewCurrentContainerId = 'workbench.explorer.fileView';
    mockViewReadyPromise = new Promise(() => {});
    const { PanelContext } = await import('@opensumi/ide-core-browser/lib/components');
    const { AILeftTabRenderer } = await import('../../src/browser/layout/tabbar.view');
    const parentResizeHandle = {
      setSize: jest.fn(),
      setRelativeSize: jest.fn(),
      getSize: jest.fn(() => 49),
      getRelativeSize: jest.fn(() => [951, 49]),
      lockSize: jest.fn(),
      setMaxSize: jest.fn(),
      hidePanel: jest.fn(),
    };

    await act(async () => {
      root.render(
        <PanelContext.Provider value={parentResizeHandle}>
          <AILeftTabRenderer className='slot-class' components={[]} />
        </PanelContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(parentResizeHandle.setSize).toHaveBeenCalledWith(310, true);
  });

  it('Given classic layout, when the hidden AI chat renderer renders, then it keeps the main branch direction', async () => {
    const { AIChatTabRenderer } = await import('../../src/browser/layout/tabbar.view');

    act(() => {
      root.render(<AIChatTabRenderer className='slot-class' components={[]} />);
    });

    expect(mockCapturedTabRendererProps.direction).toBe('left-to-right');
    expect(mockCapturedTabRendererProps.className).not.toContain('design_right_slot');
    expect(mockCapturedTabbarViewBaseProps.disableAutoAdjust).toBeUndefined();
  });

  it('Given classic layout, when the tabbed AI chat renderer renders, then it keeps the main branch right-side direction', async () => {
    const { AIChatTabRendererWithTab } = await import('../../src/browser/layout/tabbar.view');

    act(() => {
      root.render(<AIChatTabRendererWithTab className='slot-class' components={[]} />);
    });

    expect(mockCapturedTabRendererProps.direction).toBe('right-to-left');
    expect(mockCapturedTabRendererProps.className).toContain('design_right_slot');
  });

  it('Given agentic layout, when AI chat restores size, then it uses the first split child resize side', async () => {
    panelLayoutMode = 'agentic';
    const { PanelContext } = await import('@opensumi/ide-core-browser/lib/components');
    const { AIChatTabRenderer } = await import('../../src/browser/layout/tabbar.view');
    const parentResizeHandle = {
      setSize: jest.fn(),
      setRelativeSize: jest.fn(),
      getSize: jest.fn(() => 840),
      getRelativeSize: jest.fn(() => [840, 1000]),
      lockSize: jest.fn(),
      setMaxSize: jest.fn(),
      hidePanel: jest.fn(),
    };

    act(() => {
      root.render(
        <PanelContext.Provider value={parentResizeHandle}>
          <AIChatTabRenderer className='slot-class' components={[]} />
        </PanelContext.Provider>,
      );
    });

    mockCapturedResizeHandle.setSize(840, true);
    mockCapturedResizeHandle.getSize(true);

    expect(mockCapturedTabRendererProps.direction).toBe('left-to-right');
    expect(parentResizeHandle.setSize).toHaveBeenCalledWith(840, false);
    expect(parentResizeHandle.getSize).toHaveBeenCalledWith(false);
  });

  it('Given agentic layout, when the hidden AI chat tabbar renders, then it does not render overflow tabs', async () => {
    panelLayoutMode = 'agentic';
    const { AIChatTabRenderer } = await import('../../src/browser/layout/tabbar.view');

    act(() => {
      root.render(<AIChatTabRenderer className='slot-class' components={[]} />);
    });

    expect(mockCapturedTabbarViewBaseProps).toMatchObject({
      barSize: 0,
      panelBorderSize: 0,
      tabSize: 0,
      disableAutoAdjust: true,
    });
  });
});
