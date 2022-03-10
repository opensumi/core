import { IContextKeyService } from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuRegistryImpl, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { DisposableStore } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { SCMModule } from '../../src/browser';
import { ISCMMenus } from '../../src/common';
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';

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
    injector = createBrowserInjector(
      [SCMModule],
      new MockInjector([
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        {
          token: IMenuRegistry,
          useClass: MenuRegistryImpl,
        },
      ]),
    );
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

    it('ok', () => {
      const repoProvider = new MockSCMProvider(0);
      const scmMenus = injector.get<ISCMMenus>(ISCMMenus);
      const menuNodes = scmMenus.getRepositoryMenus(repoProvider).titleMenu.getMergedMenuNodes();
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
    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [
      new MockSCMResource(mockSCMResourceGroup0, undefined, undefined, undefined),
    ]);
    mockProvider0.groups.splice(mockProvider0.groups.elements.length, 0, [mockSCMResourceGroup0]);

    const scmMenus = injector.get<ISCMMenus>(ISCMMenus);

    const [inlineMenuNodes, contextMenuNodes] = scmMenus
      .getRepositoryMenus(mockProvider0)
      .getResourceGroupMenu(mockSCMResourceGroup0)
      .getGroupedMenuNodes();

    expect(contextMenuNodes.length).toBe(1);
    expect(contextMenuNodes[0].label).toBe('fakeCmd2');

    expect(inlineMenuNodes.length).toBe(1);
    expect(inlineMenuNodes[0].label).toBe('fakeCmd1');

    const mockSCMResourceGroup1 = new MockSCMResourceGroup(mockProvider0, 1);

    const tupleMenuNodes = scmMenus
      .getRepositoryMenus(mockProvider0)
      .getResourceGroupMenu(mockSCMResourceGroup1)
      .getGroupedMenuNodes();

    expect(tupleMenuNodes).toEqual([[], []]);
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
    const mockSCMResource0 = new MockSCMResource(mockSCMResourceGroup0, undefined, undefined, undefined);
    mockProvider0.groups.splice(mockProvider0.groups.elements.length, 0, [mockSCMResourceGroup0]);

    const scmMenus = injector.get<ISCMMenus>(ISCMMenus);

    const [inlineMenuNodes, contextMenuNodes] = scmMenus
      .getRepositoryMenus(mockProvider0)
      .getResourceMenu(mockSCMResource0)
      .getGroupedMenuNodes();

    expect(inlineMenuNodes.length).toBe(1);
    expect(inlineMenuNodes[0].label).toBe('fakeCmd1');

    expect(contextMenuNodes.length).toBe(1);
    expect(contextMenuNodes[0].label).toBe('fakeCmd2');

    const mockSCMResourceGroup1 = new MockSCMResourceGroup(mockProvider0, 1);
    const mockSCMResource2 = new MockSCMResource(mockSCMResourceGroup1, undefined, undefined, undefined);

    const tupleMenuNodes2 = scmMenus
      .getRepositoryMenus(mockProvider0)
      .getResourceMenu(mockSCMResource2)
      .getGroupedMenuNodes();

    expect(tupleMenuNodes2).toEqual([[], []]);
  });
});
