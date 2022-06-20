import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IContextKeyService, IEventBus, ToolbarActionsWhenChangeEvent } from '../../src';
import { IToolbarRegistry } from '../../src/toolbar';
import { NextToolbarRegistryImpl } from '../../src/toolbar/toolbar.registry';

describe('toolbar tests', () => {
  let injector: MockInjector;
  let toolbarRegistry: IToolbarRegistry;
  beforeEach(() => {
    injector = injector = createBrowserInjector([]);
    toolbarRegistry = injector.get<IToolbarRegistry>(IToolbarRegistry);
    toolbarRegistry.registerToolbarActionGroup({
      id: 'editor',
    });
    (toolbarRegistry as NextToolbarRegistryImpl).init();
  });
  afterEach(() => {
    injector.disposeAll();
  });
  it('get actions', () => {
    toolbarRegistry.registerToolbarAction({
      id: 'run',
      description: 'run-button',
      component: {} as any,
      strictPosition: {
        location: 'default',
        group: 'editor',
      },
    });

    const actions = toolbarRegistry.getToolbarActions({
      location: 'default',
      group: 'editor',
    });
    expect(actions).toBeDefined();
    expect(actions!.actions).toHaveLength(1);
  });

  it('should get empty actions if when was false', () => {
    toolbarRegistry.registerToolbarAction({
      id: 'run',
      description: 'run-button',
      when: 'false',
      component: {} as any,
      strictPosition: {
        location: 'default',
        group: 'editor',
      },
    });

    const actions = toolbarRegistry.getToolbarActions({
      location: 'default',
      group: 'editor',
    });
    expect(actions).toBeDefined();
    expect(actions!.actions).toHaveLength(0);
  });

  it('shoud get action if contextkey was true', () => {
    const globalContextKeyService = injector.get<IContextKeyService>(IContextKeyService);
    globalContextKeyService.createKey('showMe', true);
    toolbarRegistry.registerToolbarAction({
      id: 'run',
      description: 'run-button',
      when: 'showMe',
      component: {} as any,
      strictPosition: {
        location: 'default',
        group: 'editor',
      },
    });

    const actions = toolbarRegistry.getToolbarActions({
      location: 'default',
      group: 'editor',
    });
    expect(actions).toBeDefined();
    expect(actions!.actions).toHaveLength(1);
  });

  it('shoud get action if contextkey change', async () => {
    const globalContextKeyService = injector.get<IContextKeyService>(IContextKeyService);
    toolbarRegistry.registerToolbarAction({
      id: 'run',
      description: 'run-button',
      when: 'showMe',
      component: {} as any,
      strictPosition: {
        location: 'default',
        group: 'editor',
      },
    });

    const actions = toolbarRegistry.getToolbarActions({
      location: 'default',
      group: 'editor',
    });
    expect(actions).toBeDefined();
    expect(actions!.actions).toHaveLength(0);
    // 设置 contextvalue 为 true
    globalContextKeyService.createKey('showMe', true);
    const actions2 = toolbarRegistry.getToolbarActions({
      location: 'default',
      group: 'editor',
    });
    expect(actions2!.actions).toHaveLength(1);
  });
});
