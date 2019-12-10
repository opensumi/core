import * as React from 'react';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IMainLayoutService, MainLayoutContribution } from '../../src';
import { ComponentRegistryImpl, ComponentRegistry, SlotLocation, AppConfig, IContextKeyService, CommandRegistry, ILoggerManagerClient, IEventBus, RenderedEvent, ViewContainerOptions } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { useMockStorage } from '@ali/ide-core-browser/lib/mocks/storage';
import { MainLayoutModuleContribution } from '../../src/browser/main-layout.contribution';
import { ActivationEventService } from '@ali/ide-activation-event';
import { ActivationEventServiceImpl } from '@ali/ide-activation-event/lib/browser/activation.service';
import { LayoutState } from '@ali/ide-core-browser/lib/layout/layout-state';
import { MockLoggerManageClient } from '@ali/ide-core-browser/lib/mocks/logger';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { LayoutService } from '../../src/browser/layout.service';
import { autorun } from 'mobx';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';

const MockView = () => <div>Test view</div>;

describe('main layout test', () => {
  let service: LayoutService;
  let injector: MockInjector;
  const testToken = 'componentToken';
  const layoutNode = document.createElement('div');
  document.getElementById('main')!.appendChild(layoutNode);

  const mockLayoutContribution: MainLayoutContribution = {
    onDidRender() {
      console.log('layout contribution');
    },
  };
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
      [SlotLocation.leftBar]: {
        modules: [testToken],
      },
      [SlotLocation.leftPanel]: {
        modules: [testToken],
      },
      [SlotLocation.right]: {
        modules: [testToken],
      },
      [SlotLocation.rightBar]: {
        modules: [testToken],
        size: 0,
      },
      [SlotLocation.rightPanel]: {
        modules: [testToken],
      },
      [SlotLocation.bottom]: {
        modules: [testToken],
      },
      [SlotLocation.bottomBar]: {
        modules: [testToken],
        size: 0,
      },
      [SlotLocation.bottomPanel]: {
        modules: [testToken],
      },
      [SlotLocation.statusBar]: {
        modules: [testToken],
      },
    },
  };
  const timeoutIds: Set<NodeJS.Timer> = new Set();

  beforeAll(() => {
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

    injector = createBrowserInjector([]);

    injector.overrideProviders(
      {
        token: AppConfig,
        useValue: config,
      },
    );

    injector.addProviders(
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
        token: MainLayoutContribution,
        useValue: {
          getContributions: () => [mockLayoutContribution],
        },
      },
      {
        token: MainLayoutModuleContribution,
        useClass: MainLayoutModuleContribution,
      },
      {
        token: ActivationEventService,
        useClass: ActivationEventServiceImpl,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
    );
    useMockStorage(injector);
    service = injector.get(IMainLayoutService);
  });
  afterAll(() => {
    if (timeoutIds.size > 0) {
      timeoutIds.forEach((t) => clearTimeout(t));
      timeoutIds.clear();
    }
  });

  it('should be able to collect tabbar component at any time', () => {
    service.collectTabbarComponent([{
      component: MockView,
      id: 'test-view-id',
    }], {
      containerId: 'container-before-render',
      title: 'test title',
    }, 'bottom');
    expect(service.getTabbarHandler('container-before-render')).toBeDefined();
  });

  it('should be able to register component', () => {
    const registry: ComponentRegistry = injector.get(ComponentRegistry);
    registry.register(testToken, [{
      component: MockView,
      id: 'test-view-id2',
    }], {
      containerId: 'containerId',
      iconClass: 'testicon iconfont',
      priority: 10,
      title: 'test title',
      expanded: false,
      size: 300,
      initialProps: {},
      activateKeyBinding: 'cmd+1',
      hidden: false,
    });
    const info = registry.getComponentRegistryInfo(testToken);
    expect(info).toBeDefined();
    expect(info!.options!.containerId).toEqual('containerId');
  });

  it('should be able to init layout state storage & restore state & register toggle commands', async (done) => {
    const layoutState = injector.get(LayoutState);
    await layoutState.initStorage();
    const contribution: MainLayoutModuleContribution = injector.get(MainLayoutModuleContribution);
    const registry = injector.get(CommandRegistry);
    contribution.registerCommands(registry);
    done();
  });

  it('should be able to collect component as side container & get handler', async (done) => {
    expect(service.getTabbarHandler('container-before-render')).toBeDefined();
    const options: ViewContainerOptions = {
      containerId: 'testContainerId',
      iconClass: 'testicon iconfont',
      priority: 10,
      title: 'test title',
      expanded: false,
      size: 300,
      badge: '9',
      initialProps: {hello: 'world'},
      activateKeyBinding: 'cmd+1',
      hidden: false,
    };
    const handlerId = service.collectTabbarComponent([{
      component: MockView,
      id: 'test-view-id',
    }], options, 'left');
    const handler = service.getTabbarHandler(handlerId);
    expect(handler).toBeDefined();
    const disposer = autorun(() => {
      const info = service.getTabbarService('left');
      const opt = info.getContainer('testContainerId')!.options!;
      console.log('autorun:', opt.badge, opt.title, opt.initialProps);
      if (opt.title === 'gggggggg') {
        done();
      }
    });
    handler.setBadge('20');
    handler.updateTitle('gggggggg');
    disposer();
  });

  it('should be able to register React components as container directly', () => {
    const handlerId = service.collectTabbarComponent([], {
      containerId: 'container-use-react',
      title: 'test title',
    }, 'bottom', MockView);
    const accordionService = service.getAccordionService('container-use-react');
    expect(accordionService.views.length).toEqual(0);
    const handler = service.getTabbarHandler(handlerId);
    expect(handler).toBeDefined();
  });

  // it('toggle slot should work', async (done) => {
  //   const eventBus: IEventBus = injector.get(IEventBus);
  //   eventBus.on(RenderedEvent, async () => {
  //     const leftTabbarService = service.getTabbarService('left');
  //     // currentContainerId undefined默认会使用第一个tab
  //     expect(leftTabbarService.currentContainerId).toBeUndefined();
  //     const bottomTabbarService = service.getTabbarService('bottom');
  //     expect(bottomTabbarService.currentContainerId).toBeUndefined();
  //     const rightTabbarService = service.getTabbarService('right');
  //     // currentContainerId 空字符串表示当前未选中任何tab
  //     expect(rightTabbarService.currentContainerId).toEqual('');

  //     await service.toggleSlot('left');
  //     expect(leftTabbarService.currentContainerId).toBeFalsy();
  //     await service.toggleSlot('bottom');
  //     expect(bottomTabbarService.currentContainerId).toBeFalsy();
  //     await service.toggleSlot('right');
  //     expect(rightTabbarService.currentContainerId).toBeTruthy();
  //     done();
  //   });
  // });
});
