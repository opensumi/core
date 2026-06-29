import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const mockTabbarServiceFactoryToken = Symbol('TabbarServiceFactory');
const mockProgressServiceToken = Symbol('IProgressService');
const mockKeybindingRegistryToken = Symbol('KeybindingRegistry');
let mockVisibleContainers: any[] = [];
let mockCurrentContainerId = 'explorer';

const mockTabbarService = {
  currentContainerId: {
    get: jest.fn(() => mockCurrentContainerId),
  },
  visibleContainers: mockVisibleContainers,
  updateBarSize: jest.fn(),
  updateTabInMoreKey: jest.fn(),
  handleDragStart: jest.fn(),
  handleDragEnd: jest.fn(),
  handleDrop: jest.fn(),
  handleContextMenu: jest.fn(),
  handleTabClick: jest.fn(),
  showMoreMenu: jest.fn(),
  onDidRegisterContainer: jest.fn(),
  onStateChange: jest.fn(),
};

const mockProgressService = {
  getIndicator: jest.fn(() => undefined),
};

jest.mock('@opensumi/ide-components', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Icon: () => <span />,
}));

jest.mock('@opensumi/ide-core-browser', () => ({
  BasicEvent: class BasicEvent<T> {
    constructor(public payload: T) {}
  },
  Event: {
    any: () => () => ({ dispose: jest.fn() }),
  },
  KeybindingRegistry: mockKeybindingRegistryToken,
  SlotLocation: {
    extendView: 'extendView',
    panel: 'panel',
    view: 'view',
  },
  addClassName: jest.fn(),
  getIcon: (icon: string) => `icon-${icon}`,
  useAutorun: (value: any) => (typeof value?.get === 'function' ? value.get() : value),
  useDesignStyles: (className: string) => className,
  useInjectable: (token: any) => {
    if (token === mockTabbarServiceFactoryToken) {
      return () => mockTabbarService;
    }
    if (token === mockProgressServiceToken) {
      return mockProgressService;
    }
    if (token === mockKeybindingRegistryToken) {
      return {
        acceleratorForKeyString: (key: string) => key,
      };
    }
    return {};
  },
  usePreference: (_key: string, defaultValue: boolean) => defaultValue,
}));

jest.mock('@opensumi/ide-core-browser/lib/components/actions', () => ({
  InlineMenuBar: () => <span />,
}));

jest.mock('@opensumi/ide-core-browser/lib/components/layout/layout', () => ({
  Layout: {
    getFlexDirection: () => 'row',
    getTabbarDirection: () => 'column',
  },
}));

jest.mock('@opensumi/ide-core-browser/lib/layout/view-id', () => ({
  VIEW_CONTAINERS: {
    LEFT_TABBAR: 'left-tabbar',
  },
}));

jest.mock('@opensumi/ide-core-browser/lib/progress', () => ({
  IProgressService: mockProgressServiceToken,
}));

jest.mock('@opensumi/ide-monaco/lib/common/observable', () => ({
  observableValue: () => ({
    get: () => false,
  }),
}));

jest.mock('../../src/browser/tabbar/tabbar.service', () => ({
  TabbarServiceFactory: mockTabbarServiceFactoryToken,
}));

jest.mock('../../src/browser/tabbar/renderer.view', () => {
  const React = require('react');
  return {
    TabbarConfig: React.createContext({ side: 'view', direction: 'left-to-right', fullSize: 480 }),
  };
});

describe('TabbarViewBase', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderTabbar = (containerFilter?: (component: any) => boolean) => {
    const { TabbarViewBase } = require('../../src/browser/tabbar/bar.view');
    const { TabbarConfig } = require('../../src/browser/tabbar/renderer.view');
    const TabView = ({ component }: { component: any }) => (
      <span data-testid='tabbar-entry'>{component.options.containerId}</span>
    );
    const MoreTabView = () => <span data-testid='tabbar-more'>more</span>;

    act(() => {
      root.render(
        <TabbarConfig.Provider value={{ side: 'view', direction: 'left-to-right', fullSize: 480 }}>
          <TabbarViewBase tabSize={48} MoreTabView={MoreTabView} TabView={TabView} containerFilter={containerFilter} />
        </TabbarConfig.Provider>,
      );
    });
  };

  beforeEach(() => {
    mockCurrentContainerId = 'explorer';
    mockVisibleContainers = [
      { options: { containerId: 'explorer' } },
      { options: { containerId: 'search' } },
      { options: { containerId: 'scm' } },
      { options: { containerId: 'debug' } },
      { options: { containerId: 'extension' } },
      { options: { containerId: 'hidden', hideTab: true } },
    ];
    mockTabbarService.visibleContainers = mockVisibleContainers;
    mockTabbarService.updateBarSize.mockClear();
    mockTabbarService.updateTabInMoreKey.mockClear();
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

  it('renders all non-hidden containers when no filter is provided', () => {
    renderTabbar();

    expect(
      Array.from(container.querySelectorAll('[data-testid="tabbar-entry"]')).map((node) => node.textContent),
    ).toEqual(['explorer', 'search', 'scm', 'debug', 'extension']);
  });

  it('applies the optional container filter to visible entries', () => {
    renderTabbar((component) => ['explorer', 'scm'].includes(component.options?.containerId));

    expect(
      Array.from(container.querySelectorAll('[data-testid="tabbar-entry"]')).map((node) => node.textContent),
    ).toEqual(['explorer', 'scm']);
  });
});
