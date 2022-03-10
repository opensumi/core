import React from 'react';
import { act } from 'react-dom/test-utils';

import {
  ComponentRegistryImpl,
  ComponentRegistry,
  SlotLocation,
  AppConfig,
  IContextKeyService,
  CommandRegistry,
  ILoggerManagerClient,
  ViewContainerOptions,
  PreferenceService,
  Disposable,
  ClientApp,
} from '@opensumi/ide-core-browser';
import { MockLoggerManageClient } from '@opensumi/ide-core-browser/__mocks__/logger';
import { useMockStorage } from '@opensumi/ide-core-browser/__mocks__/storage';
import { LayoutState } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { CommonServerPath, Deferred, OS } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { MainLayoutModule } from '@opensumi/ide-main-layout/lib/browser';
import { LayoutService } from '@opensumi/ide-main-layout/lib/browser/layout.service';
import { MainLayoutModuleContribution } from '@opensumi/ide-main-layout/lib/browser/main-layout.contribution';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

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
  document.getElementById('main')!.appendChild(layoutNode);

  const timeoutIds: Set<NodeJS.Timer> = new Set();

  beforeAll(async (done) => {
    let timeCount = 0;
    window.requestAnimationFrame = (cb) => {
      const cancelToken = 111;
      const timeoutId = global.setTimeout(() => {
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
    // tslint:disable-next-line: only-arrow-functions
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
        [SlotLocation.left]: {
          modules: [testToken],
        },
        [SlotLocation.right]: {
          modules: [uniqueToken],
        },
        [SlotLocation.bottom]: {
          modules: [testToken],
        },
        [SlotLocation.statusBar]: {
          modules: [testToken],
        },
      },
    };

    injector.overrideProviders(
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
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
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
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
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
        done();
      });
      service = injector.get(IMainLayoutService);
      // 测试环境下，readDom 的 render 回调的时候不知道为啥 render 还没执行到 tabbarRenderer，需要兼容下，先初始化好tababrService
      service.getTabbarService('left');
      service.getTabbarService('right');
      service.getTabbarService('bottom');
    });
  });
  afterAll(() => {
    if (timeoutIds.size > 0) {
      timeoutIds.forEach((t) => clearTimeout(t));
      timeoutIds.clear();
    }
  });

  // main logic test
  it('containers in layout config should be registed', () => {
    const rightTabbarService = service.getTabbarService('right');
    expect(rightTabbarService.visibleContainers.length).toEqual(1);
    const accordionService = service.getAccordionService(testContainerId);
    expect(accordionService.visibleViews.length).toEqual(2);
  });

  // container api test start

  it('should be able to collect tabbar component at any time', () => {
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
      'bottom',
    );
    expect(service.getTabbarHandler('container-before-render')).toBeDefined();
  });

  it('should be able to init layout state storage & restore state & register toggle commands', async (done) => {
    const layoutState = injector.get(LayoutState);
    await layoutState.initStorage();
    const contribution: MainLayoutModuleContribution = injector.get(MainLayoutModuleContribution);
    const registry = injector.get(CommandRegistry);
    contribution.registerCommands(registry);
    done();
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
      badge: '9',
      initialProps: { hello: 'world' },
      activateKeyBinding: 'ctrlcmd+1',
      hidden: false,
    };
    const handlerId = service.collectTabbarComponent(
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
      'left',
    );
    const handler = service.getTabbarHandler(handlerId)!;
    const tabbarService = service.getTabbarService('left');
    expect(handler).toBeDefined();
    const mockCb = jest.fn();
    handler.onActivate(mockCb);
    handler.onInActivate(mockCb);
    handler.activate();
    expect(tabbarService.currentContainerId).toEqual(testContainerId2);
    expect(handler.isActivated()).toBeTruthy();
    handler.deactivate();
    expect(handler.isActivated()).toBeFalsy();
    expect(tabbarService.currentContainerId).toEqual('');
    handler.disposeView('test-view-id4');
    expect(handler.accordionService.views.length).toEqual(1);
    handler.hide();
    expect(tabbarService.getContainerState(testContainerId2).hidden).toEqual(true);
    handler.show();
    expect(tabbarService.getContainerState(testContainerId2).hidden).toEqual(false);
    expect(handler.isCollapsed('test-view-id5')).toBeFalsy();
    handler.setCollapsed('test-view-id5', true);
    expect(handler.isCollapsed('test-view-id5')).toBeTruthy();
    expect(mockCb).toBeCalledTimes(2);
    handler.setBadge('20');
    handler.updateTitle('gggggggg');
    jest.advanceTimersByTime(20);
    expect(tabbarService.getContainer(testContainerId2)!.options!.title).toEqual('gggggggg');
    handler.updateViewTitle('test-view-id5', 'new title');
    expect(handler.accordionService.views.find((view) => view.id === 'test-view-id5')?.name === 'new title');
    handler.toggleViews(['test-view-id5'], false);
    expect(handler.accordionService.getViewState('test-view-id5').hidden).toBeTruthy();
    handler.dispose();
    expect(tabbarService.getContainer(testContainerId2)).toBeUndefined();
  });

  it('should be able to register React components as container directly', () => {
    const handlerId = service.collectTabbarComponent(
      [],
      {
        containerId: 'container-use-react',
        title: 'test title',
        component: MockView,
        initialProps: {
          message: 'hello world',
        },
      },
      'bottom',
    );
    const accordionService = service.getAccordionService('container-use-react');
    expect(accordionService.views.length).toEqual(0);
    const handler = service.getTabbarHandler(handlerId);
    expect(handler).toBeDefined();
    const testDom = document.getElementById('test-unique-id');
    expect(testDom).toBeDefined();
  });

  it('should`t render tab view with hideTab option', () => {
    service.collectTabbarComponent(
      [],
      {
        containerId: 'containerWithTab',
        component: MockView,
      },
      'left',
    );
    expect(document.getElementById('containerWithTab')).toBeDefined();
    service.collectTabbarComponent(
      [],
      {
        containerId: 'containerWithoutTab',
        component: MockView,
        hideTab: true,
      },
      'left',
    );
    expect(document.getElementById('containerWithoutTab')).toBeNull();
  });

  // view api test start

  it('should be able to collect view into existing container and replace & dispose existing view', async (done) => {
    const tmpViewId = 'test-view-id5';
    const tmpDomId = 'test-dom-5';
    service.collectViewComponent(
      {
        id: tmpViewId,
        component: MockView,
      },
      testContainerId,
      { message: 'yes' },
    );
    act(() => {
      jest.advanceTimersByTime(10);
    });
    const accordionService = service.getAccordionService(testContainerId);
    expect(accordionService.views.find((val) => val.id === tmpViewId)).toBeDefined();
    service.replaceViewComponent(
      {
        id: tmpViewId,
        component: (props) => <h1 id={tmpDomId}>{props.id || 'no props'}</h1>,
      },
      { id: 'hello world' },
    );
    act(() => {
      jest.advanceTimersByTime(10);
    });
    // await wait(200);
    const newDom = document.getElementById(tmpDomId);
    expect(newDom).toBeDefined();
    expect(newDom!.innerHTML).toEqual('hello world');
    service.disposeViewComponent(tmpViewId);
    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(accordionService.views.find((val) => val.id === tmpViewId)).toBeUndefined();
    done();
  });

  it('shouldn`t register empty tabbar component with hideIfEmpty option until valid view collected', () => {
    const emptyContainerId = 'emptyContainerId';
    service.collectTabbarComponent([], { hideIfEmpty: true, containerId: emptyContainerId }, 'left');
    const tabbarService = service.getTabbarService('left');
    expect(tabbarService.getContainer(emptyContainerId)).toBeUndefined();
    service.collectViewComponent({ id: 'testViewId', component: MockView }, emptyContainerId);
    expect(tabbarService.getContainer(emptyContainerId)).toBeDefined();
  });

  // toggle / expand api test

  it('toggle slot should work', () => {
    const rightTabbarService = service.getTabbarService('right');
    // currentContainerId 空字符串表示当前未选中任何tab
    expect(rightTabbarService.currentContainerId).toEqual('');
    service.toggleSlot('right');
    act(() => {
      jest.advanceTimersByTime(10);
    });
    // await wait(200);
    expect(rightTabbarService.currentContainerId).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(10);
    });
    // panel visible
    expect((document.getElementsByClassName(testContainerId)[0] as HTMLDivElement).style.zIndex).toEqual('1');
  });

  it('should be able to judge whether a tab panel is visible', () => {
    expect(service.isVisible('right')).toBeTruthy();
    service.toggleSlot('right', false);
    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(service.isVisible('right')).toBeFalsy();
  });
});
