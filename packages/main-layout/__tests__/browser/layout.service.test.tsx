import React from 'react';
import { act } from 'react-dom/test-utils';

import {
  AppConfig,
  CommandRegistry,
  ComponentRegistry,
  ComponentRegistryImpl,
  Disposable,
  IContextKeyService,
  PreferenceService,
  SlotLocation,
  ViewContainerOptions,
} from '@opensumi/ide-core-browser';
import { MockLoggerManageClient } from '@opensumi/ide-core-browser/__mocks__/logger';
import { useMockStorage } from '@opensumi/ide-core-browser/__mocks__/storage';
import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';
import { LayoutState } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { CommonServerPath, Deferred, ILoggerManagerClient, OS } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { MainLayoutModule } from '@opensumi/ide-main-layout/lib/browser';
import { LayoutService } from '@opensumi/ide-main-layout/lib/browser/layout.service';
import { MainLayoutModuleContribution } from '@opensumi/ide-main-layout/lib/browser/main-layout.contribution';
import { IconService } from '@opensumi/ide-theme/lib/browser/icon.service';
import { IIconService } from '@opensumi/ide-theme/lib/common/theme.service';

import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';

const MockView = (props) => <div>Test view{props.message && <p id='test-unique-id'>has prop.message</p>}</div>;

jest.useFakeTimers();

describe('main layout test', () => {
  let service: LayoutService;
  let injector: MockInjector;
  const testToken = 'componentToken';
  const uniqueToken = 'unique_component_token';
  const testContainerId = 'unique_container_id';
  const layoutNode = document.createElement('div');
  const rendered = new Deferred<void>();
  document.getElementById('main')?.appendChild(layoutNode);

  const timeoutIds: Set<NodeJS.Timeout> = new Set();

  beforeAll(async () => {
    const defered = new Deferred();

    let timeCount = 0;
    window.requestAnimationFrame = (cb) => {
      const cancelToken = 111;
      const timeoutId = setTimeout(() => {
        timeCount += 30;
        cb(timeCount);
        timeoutIds.delete(timeoutId);
      }, 30);
      timeoutIds.add(timeoutId);
      return cancelToken;
    };
    window.cancelAnimationFrame = () => {
      // mock cancelAnimationFrame
    };
    (window as any).ResizeObserver = function () {
      this.observe = () => {};
      this.disconnect = () => {};
      this.unobserve = () => {};
      return this;
    };

    injector = new MockInjector();

    const config: Partial<AppConfig> = {
      layoutConfig: {
        [SlotLocation.main]: {
          modules: [testToken],
        },
        [SlotLocation.top]: {
          modules: [testToken],
        },
        [SlotLocation.view]: {
          modules: [testToken],
        },
        [SlotLocation.extendView]: {
          modules: [uniqueToken],
        },
        [SlotLocation.panel]: {
          modules: [testToken],
        },
        [SlotLocation.statusBar]: {
          modules: [testToken],
        },
      },
    };

    injector.addProviders(
      {
        token: IIconService,
        useClass: IconService,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
      {
        token: IMainLayoutService,
        useClass: LayoutService,
      },
      {
        token: ComponentRegistry,
        useClass: ComponentRegistryImpl,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: PreferenceService,
        useValue: {
          ready: Promise.resolve(),
          get: () => undefined,
          onPreferenceChanged: () => Disposable.create(() => {}),
          onSpecificPreferenceChange: (func: any) => Disposable.create(() => {}),
        },
      },
      {
        token: CommonServerPath,
        useValue: {
          async getBackendOS() {
            return Promise.resolve(OS.type());
          },
        },
      },
      MainLayoutModuleContribution,
    );
    useMockStorage(injector);
    const registry: ComponentRegistry = injector.get(ComponentRegistry);
    registry.register(
      testToken,
      [
        {
          component: MockView,
          id: 'test-view-id',
        },
      ],
      {
        containerId: 'containerId',
        iconClass: 'testicon iconfont',
        priority: 10,
        title: 'test title',
        expanded: false,
        size: 300,
        initialProps: {},
        activateKeyBinding: 'ctrlcmd+1',
        hidden: false,
      },
    );
    registry.register(
      uniqueToken,
      [
        {
          component: MockView,
          id: 'test-view-id1',
        },
        {
          component: MockView,
          id: 'test-view-id2',
        },
      ],
      {
        containerId: testContainerId,
        iconClass: 'testicon iconfont',
        priority: 10,
        title: 'test title',
        expanded: false,
        size: 300,
        activateKeyBinding: 'ctrlcmd+1',
        hidden: false,
      },
    );
    await act(async () => {
      const app = new ClientApp({
        modules: [MainLayoutModule],
        injector,
        didRendered: () => rendered.resolve(),
        ...config,
      });
      app.start(document.getElementById('main')!).then(async () => {
        await rendered.promise;
        await service.viewReady.promise;
        defered.resolve();
      });
      service = injector.get(IMainLayoutService);
      // 测试环境下，readDom 的 render 回调的时候不知道为啥 render 还没执行到 tabbarRenderer，需要兼容下，先初始化好tababrService
      service.getTabbarService(SlotLocation.view);
      service.getTabbarService(SlotLocation.extendView);
      service.getTabbarService(SlotLocation.panel);
    });
    await defered.promise;
  });

  afterAll(() => {
    if (timeoutIds.size > 0) {
      timeoutIds.forEach((t) => clearTimeout(t));
      timeoutIds.clear();
    }
  });

  // main logic test
  it('containers in layout config should be registed', () => {
    const rightTabbarService = service.getTabbarService(SlotLocation.extendView);
    expect(rightTabbarService.visibleContainers.length).toEqual(1);
  });

  // container api test start

  it('should be able to collect tabbar component at any time', () => {
    act(() => {
      service.collectTabbarComponent(
        [
          {
            component: MockView,
            id: 'test-view-id3',
          },
        ],
        {
          containerId: 'container-before-render',
          title: 'test title',
        },
        SlotLocation.panel,
      );
    });
    expect(service.getTabbarHandler('container-before-render')).toBeDefined();
  });

  it('should be able to init layout state storage & restore state & register toggle commands', async () => {
    const layoutState = injector.get(LayoutState);
    await layoutState.initStorage();
    const contribution: MainLayoutModuleContribution = injector.get(MainLayoutModuleContribution);
    const registry = injector.get(CommandRegistry);
    contribution.registerCommands(registry);
  });

  it('should be able to collect component as side container & get handler & manualy dispose', () => {
    const testContainerId2 = 'unique_container_id_2';
    const options: ViewContainerOptions = {
      containerId: testContainerId2,
      iconClass: 'testicon iconfont',
      priority: 10,
      title: 'test title',
      expanded: false,
      size: 300,
      badge: { value: 9, tooltip: '9' },
      initialProps: { hello: 'world' },
      activateKeyBinding: 'ctrlcmd+1',
      hidden: false,
    };
    act(() => {
      service.collectTabbarComponent(
        [
          {
            component: MockView,
            id: 'test-view-id4',
          },
          {
            component: MockView,
            id: 'test-view-id5',
          },
        ],
        options,
        SlotLocation.view,
      );
    });
    const handler = service.getTabbarHandler(testContainerId2)!;
    const tabbarService = service.getTabbarService(SlotLocation.view);
    expect(handler).toBeDefined();
    const mockCb = jest.fn();
    handler.onActivate(mockCb);
    handler.onInActivate(mockCb);
    act(() => {
      handler.activate();
    });
    expect(tabbarService.currentContainerId.get()).toEqual(testContainerId2);
    expect(handler.isActivated()).toBeTruthy();
    act(() => {
      handler.deactivate();
    });
    expect(handler.isActivated()).toBeFalsy();
    expect(tabbarService.currentContainerId.get()).toEqual('');
    act(() => {
      handler.disposeView('test-view-id4');
    });
    expect(handler.accordionService.views.length).toEqual(1);
    act(() => {
      handler.hide();
    });
    expect(tabbarService.getContainerState(testContainerId2).hidden).toEqual(true);
    act(() => {
      handler.show();
    });
    expect(tabbarService.getContainerState(testContainerId2).hidden).toEqual(false);
    expect(handler.isCollapsed('test-view-id5')).toBeFalsy();
    act(() => {
      handler.setCollapsed('test-view-id5', true);
    });
    expect(handler.isCollapsed('test-view-id5')).toBeTruthy();
    expect(mockCb).toHaveBeenCalledTimes(4);
    let newTitle = 'new title';
    act(() => {
      handler.setBadge({ value: 20, tooltip: '20' });
      handler.updateTitle(newTitle);
    });
    expect(tabbarService.getContainer(testContainerId2)!.options!.title).toEqual(newTitle);
    newTitle = 'new title 2';
    act(() => {
      handler.updateViewTitle('test-view-id5', newTitle);
    });
    expect(handler.accordionService.views.find((view) => view.id === 'test-view-id5')?.name === newTitle);
    act(() => {
      handler.toggleViews(['test-view-id5'], false);
    });
    expect(handler.accordionService.getViewState('test-view-id5').hidden).toBeTruthy();
    act(() => {
      handler.dispose();
    });
    expect(tabbarService.getContainer(testContainerId2)).toBeUndefined();
  });

  it('should be able to register React components as container directly', () => {
    const containerId = 'container-use-react';
    act(() => {
      service.collectTabbarComponent(
        [],
        {
          containerId,
          title: 'test title',
          component: MockView,
          initialProps: {
            message: 'hello world',
          },
        },
        SlotLocation.panel,
      );
    });
    const accordionService = service.getAccordionService('container-use-react');
    expect(accordionService.views.length).toEqual(0);
    const handler = service.getTabbarHandler(containerId);
    expect(handler).toBeDefined();
    const testDom = document.getElementById('test-unique-id');
    expect(testDom).toBeDefined();
  });

  it('should`t render tab view with hideTab option', () => {
    act(() => {
      service.collectTabbarComponent(
        [],
        {
          containerId: 'containerWithTab',
          component: MockView,
        },
        SlotLocation.view,
      );
    });
    expect(document.getElementById('containerWithTab')).toBeDefined();
    act(() => {
      service.collectTabbarComponent(
        [],
        {
          containerId: 'containerWithoutTab',
          component: MockView,
          hideTab: true,
        },
        SlotLocation.view,
      );
    });
    expect(document.getElementById('containerWithoutTab')).toBeNull();
  });

  // view api test start

  it('should be able to collect view into existing container and replace & dispose existing view', async () => {
    const tmpViewId = 'test-view-id5';
    const tmpDomId = 'test-dom-5';
    act(() => {
      service.collectViewComponent(
        {
          id: tmpViewId,
          component: MockView,
        },
        testContainerId,
        { message: 'yes' },
      );
    });
    const accordionService = service.getAccordionService(testContainerId);
    expect(accordionService.views.find((val) => val.id === tmpViewId)).toBeDefined();
    act(() => {
      service.replaceViewComponent(
        {
          id: tmpViewId,
          component: (props) => <h1 id={tmpDomId}>{props.id || 'no props'}</h1>,
        },
        { id: 'hello world' },
      );
    });
    const newDom = document.getElementById(tmpDomId);
    expect(newDom).toBeDefined();
    expect(newDom!.innerHTML).toEqual('hello world');
    act(() => {
      service.disposeViewComponent(tmpViewId);
    });
    expect(accordionService.views.find((val) => val.id === tmpViewId)).toBeUndefined();
  });

  it('shouldn`t register empty tabbar component with hideIfEmpty option until valid view collected', () => {
    const emptyContainerId = 'emptyContainerId';
    act(() => {
      service.collectTabbarComponent([], { hideIfEmpty: true, containerId: emptyContainerId }, SlotLocation.view);
    });
    const tabbarService = service.getTabbarService(SlotLocation.view);
    expect(tabbarService.getContainer(emptyContainerId)).toBeUndefined();
    act(() => {
      service.collectViewComponent({ id: 'testViewId', component: MockView }, emptyContainerId);
    });
    expect(tabbarService.getContainer(emptyContainerId)).toBeDefined();
  });

  // toggle / expand api test

  it('toggle slot should work', async () => {
    const rightTabbarService = service.getTabbarService(SlotLocation.extendView);
    // currentContainerId 空字符串表示当前未选中任何tab
    expect(rightTabbarService.currentContainerId.get()).toEqual('');
    act(() => {
      service.toggleSlot(SlotLocation.extendView);
    });
    expect(rightTabbarService.currentContainerId.get()).toBeTruthy();
    // panel visible
    expect((document.getElementsByClassName(testContainerId)[0] as HTMLDivElement).style.display).toEqual('block');
  });

  it('should be able to judge whether a tab panel is visible', () => {
    expect(service.isVisible(SlotLocation.extendView)).toBeTruthy();
    act(() => {
      service.toggleSlot(SlotLocation.extendView, false);
    });
    expect(service.isVisible(SlotLocation.extendView)).toBeFalsy();
  });
});
