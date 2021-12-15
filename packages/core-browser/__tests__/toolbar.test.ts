import { createBrowserInjector } from '../../../tools/dev-tool/src/injector-helper';
import { NextToolbarRegistryImpl } from '../src/toolbar/toolbar.registry';

describe('toolbar tests', () => {
  const injector = createBrowserInjector([]);

  it('toolbar registry test', () => {
    const registry: NextToolbarRegistryImpl = injector.get(NextToolbarRegistryImpl);

    registry.addLocation('top');
    registry.addLocation('bottom');

    expect(registry.defaultLocation).toBe('top');

    registry.setDefaultLocation('bottom');

    expect(registry.defaultLocation).toBe('bottom');

    const disposer1 = registry.registerToolbarActionGroup({
      id: 'test-top',
      preferredLocation: 'top',
    });

    registry.registerToolbarActionGroup({
      id: 'test-middle',
      preferredLocation: 'middle',
    });

    registry.registerToolbarActionGroup({
      id: 'test-anywhere',
    });

    const disposer2 = registry.registerToolbarAction({
      id: 'test-top-action1',
      weight: 10,
      preferredPosition: {
        location: 'top',
        group: 'test-top',
      },
      description: 'test-top-action1',
      component: {} as any,
    });

    registry.init();

    registry.registerToolbarAction({
      id: 'test-top-action2',
      preferredPosition: {
        location: 'top',
        group: 'test-top2',
      },
      description: 'test-top-action2',
      component: {} as any,
    });

    expect(registry.getToolbarActions({ location: 'top', group: 'test-top' })).toEqual(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            id: 'test-top-action1',
          }),
        ],
      }),
    );

    expect(registry.getToolbarActions({ location: 'top', group: '_tail' })).toEqual(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            id: 'test-top-action2',
          }),
        ],
      }),
    );

    registry.registerToolbarAction({
      id: 'test-middle-action',
      preferredPosition: {
        location: 'middle',
      },
      description: 'test-middle-action',
      component: {} as any,
    });

    registry.registerToolbarAction({
      id: 'test-middle-action2',
      strictPosition: {
        location: 'bottom',
        group: 'test3',
      },
      description: 'test-middle-action2',
      component: {} as any,
    });

    expect(registry.getToolbarActions({ location: 'bottom', group: '_tail' })).toEqual(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            id: 'test-middle-action',
          }),
        ],
      }),
    );

    expect(registry.getToolbarActions({ location: 'bottom', group: 'test3' })).toBeUndefined();

    registry.registerToolbarActionGroup({
      id: 'test3',
      preferredLocation: 'bottom',
    });

    expect(registry.getToolbarActions({ location: 'bottom', group: 'test3' })).toEqual(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            id: 'test-middle-action2',
          }),
        ],
      }),
    );

    disposer1.dispose();

    expect(registry.getToolbarActions({ location: 'top', group: 'test-top' })).toBeUndefined();

    expect(registry.getToolbarActions({ location: 'top', group: '_tail' })).toEqual(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            id: 'test-top-action1',
          }),
          expect.objectContaining({
            id: 'test-top-action2',
          }),
        ],
      }),
    );

    disposer2.dispose();

    expect(registry.getToolbarActions({ location: 'top', group: '_tail' })).toEqual(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            id: 'test-top-action2',
          }),
        ],
      }),
    );
  });
});
