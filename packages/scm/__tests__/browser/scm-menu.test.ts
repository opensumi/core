import { DisposableStore } from '@ali/ide-core-common';
import { IContextKeyService } from '@ali/ide-core-browser';
import { IMenuRegistry, MenuRegistryImpl, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';

import { SCMModule } from '../../src/browser';
import { SCMMenus } from '../../src/browser/scm-menu';

describe('test for scm-menu.ts', () => {
  let injector: MockInjector;

  let menuRegistry: IMenuRegistry;
  // let contextkeyService: IContextKeyService;

  const fakeSetBadge = jest.fn();
  const fakeGetTabbarHandler = jest.fn();
  fakeGetTabbarHandler.mockReturnValue({
    setBadge: fakeSetBadge,
  });

  const disposables = new DisposableStore();

  beforeEach(() => {
    injector = createBrowserInjector([SCMModule], new MockInjector([
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: IMenuRegistry,
        useClass: MenuRegistryImpl,
      },
    ]));
    menuRegistry = injector.get(IMenuRegistry);
  });

  afterEach(() => {
    fakeSetBadge.mockReset();
    disposables.clear();
  });

  describe('test for getTitleMenu', () => {
    beforeEach(() => {
      disposables.add(
        menuRegistry.registerMenuItem(MenuId.SCMTitle, {
          command: {
            id: 'fakeCmd0',
            label: 'fakeCmd0',
          },
          group: 'navigation',
          when: '!scmProvider',
        }),
      );

      disposables.add(
        menuRegistry.registerMenuItem(MenuId.SCMTitle, {
          command: {
            id: 'fakeCmd1',
            label: 'fakeCmd1',
          },
          group: 'navigation',
          when: 'scmProvider == git',
        }),
      );

      disposables.add(
        menuRegistry.registerMenuItem(MenuId.SCMTitle, {
          command: {
            id: 'fakeCmd1',
            label: 'fakeCmd1',
          },
          group: 'navigation',
          when: 'scmProvider == what_test',
        }),
      );
    });

    it('ok for no repo', () => {
      const scmMenus = injector.get(SCMMenus, []);
      expect(scmMenus['scopedCtxKeyService'].getContextValue('scmProvider')).toBe('');

      const menuNodes = scmMenus.getTitleMenu().getMergedMenuNodes();
      expect(menuNodes.length).toBe(1);
      expect(menuNodes[0].label).toBe('fakeCmd0');
    });

    it('ok', () => {
      const repoProvider = new MockSCMProvider(0);
      const scmMenus = injector.get(SCMMenus, [repoProvider]);
      expect(scmMenus['scopedCtxKeyService'].getContextValue('scmProvider')).toBe(repoProvider.contextValue);

      const menuNodes = scmMenus.getTitleMenu().getMergedMenuNodes();
      expect(menuNodes.length).toBe(1);
      expect(menuNodes[0].label).toBe('fakeCmd1');
    });
  });

  it('test menu for ResourceGroup', () => {
    disposables.add(
      menuRegistry.registerMenuItem(MenuId.SCMResourceGroupContext, {
        command: {
          id: 'fakeCmd0',
          label: 'fakeCmd0',
        },
        group: 'ctx_menu',
        when: 'scmResourceGroup == what_test',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.SCMResourceGroupContext, {
        command: {
          id: 'fakeCmd1',
          label: 'fakeCmd1',
        },
        group: 'inline',
        when: 'scmResourceGroup == scm_resource_group_0',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.SCMResourceGroupContext, {
        command: {
          id: 'fakeCmd2',
          label: 'fakeCmd2',
        },
        group: 'ctx_menu',
        when: 'scmResourceGroup == scm_resource_group_0',
      }),
    );

    const mockProvider0 = new MockSCMProvider(0);
    // prepare data
    const mockSCMResourceGroup0 = new MockSCMResourceGroup(mockProvider0, 0);
    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [new MockSCMResource(mockSCMResourceGroup0)]);
    mockProvider0.groups.splice(mockProvider0.groups.elements.length, 0, [mockSCMResourceGroup0]);

    const scmMenus = injector.get(SCMMenus, [mockProvider0]);

    const menuNodes = scmMenus.getResourceGroupContextActions(mockSCMResourceGroup0);
    expect(menuNodes.length).toBe(1);
    expect(menuNodes[0].label).toBe('fakeCmd2');

    const [inlineMenuNodes] = scmMenus
      .getResourceGroupInlineActions(mockSCMResourceGroup0)!
      .getGroupedMenuNodes();

    expect(inlineMenuNodes.length).toBe(1);
    expect(inlineMenuNodes[0].label).toBe('fakeCmd1');

    const mockSCMResourceGroup1 = new MockSCMResourceGroup(mockProvider0, 1);
    expect(scmMenus.getResourceGroupContextActions(mockSCMResourceGroup1).length).toBe(0);
    expect(scmMenus.getResourceGroupInlineActions(mockSCMResourceGroup1)).toBeUndefined();
  });

  it('test menu for Resource context menu', () => {
    disposables.add(
      menuRegistry.registerMenuItem(MenuId.SCMResourceContext, {
        command: {
          id: 'fakeCmd0',
          label: 'fakeCmd0',
        },
        group: 'ctx_menu',
        when: 'scmResourceGroup == what_test',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.SCMResourceContext, {
        command: {
          id: 'fakeCmd1',
          label: 'fakeCmd1',
        },
        group: 'inline',
        when: 'scmResourceGroup == scm_resource_group_0',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.SCMResourceContext, {
        command: {
          id: 'fakeCmd2',
          label: 'fakeCmd2',
        },
        group: 'ctx_menu',
        when: 'scmResourceGroup == scm_resource_group_0',
      }),
    );

    const mockProvider0 = new MockSCMProvider(0);
    // prepare data
    const mockSCMResourceGroup0 = new MockSCMResourceGroup(mockProvider0, 0);
    const mockSCMResource0 = new MockSCMResource(mockSCMResourceGroup0);
    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [mockSCMResource0]);
    mockProvider0.groups.splice(mockProvider0.groups.elements.length, 0, [mockSCMResourceGroup0]);

    const scmMenus = injector.get(SCMMenus, [mockProvider0]);

    const menuNodes = scmMenus.getResourceContextActions(mockSCMResource0);
    expect(menuNodes.length).toBe(1);
    expect(menuNodes[0].label).toBe('fakeCmd2');

    const [inlineMenuNodes] = scmMenus
      .getResourceInlineActions(mockSCMResourceGroup0)!
      .getGroupedMenuNodes();

    expect(inlineMenuNodes.length).toBe(1);
    expect(inlineMenuNodes[0].label).toBe('fakeCmd1');

    const mockSCMResourceGroup1 = new MockSCMResourceGroup(mockProvider0, 1);
    const mockSCMResource1 = new MockSCMResource(mockSCMResourceGroup1);
    expect(scmMenus.getResourceContextActions(mockSCMResource1).length).toBe(0);
    expect(scmMenus.getResourceInlineActions(mockSCMResourceGroup1)).toBeUndefined();
  });
});
