import * as React from 'react';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MainLayoutService } from '../../src/browser/main-layout.service';
import { IMainLayoutService, MainLayoutContribution } from '../../src';
import { ComponentRegistryImpl, ComponentRegistry, SlotLocation, AppConfig, IContextKeyService, CommandRegistry, ILoggerManagerClient } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-core-browser/lib/mocks/context-key';
import { IWorkspaceService } from '@ali/ide-workspace';
import { useMockStorage } from '@ali/ide-core-browser/lib/mocks/storage';
import { MainLayoutModuleContribution } from '../../src/browser/main-layout.contribution';
import { ActivationEventService } from '@ali/ide-activation-event';
import { ActivationEventServiceImpl } from '@ali/ide-activation-event/lib/browser/activation.service';
import { LayoutState } from '@ali/ide-core-browser/lib/layout/layout-state';
import { ActivityBarService } from '@ali/ide-activity-bar/lib/browser/activity-bar.service';
import { ViewContainerWidget, BottomPanelWidget, ReactPanelWidget } from '@ali/ide-activity-panel/lib/browser';
import { MockLoggerManageClient } from '@ali/ide-core-browser/lib/mocks/logger';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';

const MockView = () => <div>Test view</div>;

describe('main layout test', () => {
  let service: MainLayoutService;
  let injector: MockInjector;
  let activityBarService: ActivityBarService;
  const testToken = 'componentToken';
  const layoutNode = document.createElement('div');
  document.getElementById('main')!.appendChild(layoutNode);

  const mockLayoutContribution: MainLayoutContribution = {
    onDidUseConfig() {
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
        useClass: MainLayoutService,
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

  it('should be able to collect tabbar component before render', () => {
    service.collectTabbarComponent([{
      component: MockView,
      id: 'test-view-id',
    }], {
      containerId: 'container-before-render',
      title: 'test title',
    }, 'bottom');
    expect(service.getTabbarHandler('container-before-render')).toBeUndefined();
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
  });

  it('should be able to restore state & init layout state storage & register toggle commands & create layout & apply layout config', async (done) => {
    const layoutState = injector.get(LayoutState);
    await layoutState.initStorage();
    await service.restoreState();
    const contribution: MainLayoutModuleContribution = injector.get(MainLayoutModuleContribution);
    const registry = injector.get(CommandRegistry);
    contribution.registerCommands(registry);
    service.useConfig(layoutNode);
    done();
  });

  it('should be able to collect component as side container & get handler', () => {
    expect(service.getTabbarHandler('container-before-render')).toBeDefined();
    const handlerId = service.collectTabbarComponent([{
      component: MockView,
      id: 'test-view-id',
    }], {
      containerId: 'testContainerId',
      iconClass: 'testicon iconfont',
      priority: 10,
      title: 'test title',
      expanded: false,
      size: 300,
      initialProps: {},
      activateKeyBinding: 'cmd+1',
      hidden: false,
    }, 'left');
    const handler = service.getTabbarHandler(handlerId);
    expect(handler).toBeDefined();
  });

  it('should be able to register tabbar component into different containers', () => {
    activityBarService = injector.get(ActivityBarService);
    const viewContainer = activityBarService.getContainer('testContainerId');
    expect(viewContainer instanceof ViewContainerWidget);
    const bottomContainer = activityBarService.getContainer('container-before-render');
    expect(bottomContainer instanceof BottomPanelWidget);
  });

  it('should be able to register React components as container directly', () => {
    activityBarService = injector.get(ActivityBarService);
    const handlerId = service.collectTabbarComponent([], {
      containerId: 'container-use-react',
      title: 'test title',
    }, 'bottom', MockView);
    const ReactContainer = activityBarService.getContainer('container-use-react');
    expect(ReactContainer instanceof ReactPanelWidget);
    const handler = service.getTabbarHandler(handlerId);
    expect(handler).toBeDefined();
  });

  it('should be able to lock webview during resize', () => {
    // TODO UI测试
  });

  it('resize listeners should work for all slot', () => {
    // TODO UI测试
  });

  // TODO jsdom获取到的节点宽高为0，展开折叠动画暂时无法测试
  it('toggle slot should work', async (done) => {
    const initVisibility = service.isVisible('left');
    await service.toggleSlot('left');
    expect(service.isVisible('left') !== initVisibility).toBeTruthy();
    done();
  });
});
