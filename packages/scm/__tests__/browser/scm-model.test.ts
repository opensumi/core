import { IContextKeyService, URI } from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuId, MenuRegistryImpl } from '@opensumi/ide-core-browser/lib/menu/next';
import { DisposableCollection, Event } from '@opensumi/ide-core-common';


import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { ISCMProvider, ISCMRepository, ISCMResource, ISCMResourceGroup, SCMService } from '../../src';
import { SCMModule } from '../../src/browser';
import { ResourceGroupSplicer, ViewModelContext } from '../../src/browser/scm-model';
import { MockSCMProvider, MockSCMResource, MockSCMResourceGroup } from '../scm-test-util';

describe('test for scm.store.ts', () => {
  const toTearDown = new DisposableCollection();

  afterEach(() => toTearDown.dispose());

  describe('ViewModelContext', () => {
    let provider1: ISCMProvider;
    let provider2: ISCMProvider;
    let repo1: ISCMRepository;
    let repo2: ISCMRepository;
    let store: ViewModelContext;
    let scmService: SCMService;

    let injector: MockInjector;

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

      provider1 = new MockSCMProvider(1, 'git');
      provider2 = new MockSCMProvider(2, 'svn');

      scmService = injector.get(SCMService);
      store = injector.get(ViewModelContext);
    });

    it('ViewModelContext: already contains repos', () => {
      const repo1 = scmService.registerSCMProvider(provider1);

      repo1.setSelected(true);

      injector.addProviders(ViewModelContext);
      store = injector.get(ViewModelContext);

      expect(store.repoList.length).toBe(1);
      // 只会注册进去首个 SCMProvider
      expect(store.repoList[0].provider).toEqual(provider1);

      expect(store.selectedRepos.length).toBe(1);
      expect(store.selectedRepos[0]).toEqual(repo1);

      repo1.dispose();
      expect(store.repoList.length).toBe(0);
    });

    describe('ok', () => {
      beforeEach(() => {
        injector.addProviders(ViewModelContext);
        store = injector.get(ViewModelContext);
      });

      it('add repo and then remove them', () => {
        repo1 = scmService.registerSCMProvider(provider1);

        expect(store.repoList.length).toBe(1);
        expect(store.repoList[0].provider).toEqual(provider1);

        repo1.dispose();
        expect(store.repoList.length).toBe(0);
      });

      it('changeSelectedRepos', () => {
        repo1 = scmService.registerSCMProvider(provider1);
        repo2 = scmService.registerSCMProvider(provider2);

        repo1.setSelected(false);
        repo2.setSelected(true);
        expect(store.selectedRepos).toEqual([repo2]);
        expect(store.selectedRepo).toEqual(repo2);

        repo2.setSelected(false);
        repo1.setSelected(true);
        expect(store.selectedRepos).toEqual([repo1]);
        expect(store.selectedRepo).toEqual(repo1);
      });

      it('spliceSCMList', () => {
        const mockResourceGroup = new MockSCMResourceGroup(provider1, 0);
        const mockResource = new MockSCMResource(mockResourceGroup, undefined, undefined, undefined);

        store['spliceSCMList'](new URI('').codeUri, 0, 0, mockResourceGroup, mockResource);
        expect(store.scmList).toEqual([mockResourceGroup, mockResource]);

        const mockResourceGroup1 = new MockSCMResourceGroup(provider1, 1);
        store['spliceSCMList'](new URI('').codeUri, 1, 1, mockResourceGroup1);
        expect(store.scmList).toEqual([mockResourceGroup, mockResourceGroup1]);
      });

      it('getSCMMenuService', () => {
        expect(typeof store.menus.getRepositoryMenus).toBe('function');

        repo1 = scmService.registerSCMProvider(provider1);

        const repoMenu1 = store.menus.getRepositoryMenus(repo1.provider);
        expect(repoMenu1.titleMenu.menuId).toBe(MenuId.SCMTitle);
        expect(repoMenu1.inputMenu.menuId).toBe(MenuId.SCMInput);
        expect(typeof repoMenu1.getResourceGroupMenu).toBe('function');
        expect(typeof repoMenu1.getResourceMenu).toBe('function');

        // 这个时序很难保障
        // repo1.dispose();
        // expect(store.menus.getRepositoryMenus(repo1.provider)).toBeUndefined();
      });
    });
  });

  describe('ResourceGroupSplicer', () => {
    let resourceGroup: ResourceGroupSplicer;
    let repo: ISCMRepository;
    let provider: MockSCMProvider;
    beforeEach(() => {
      const scmService = new SCMService();
      provider = new MockSCMProvider(1);
      repo = scmService.registerSCMProvider(provider);
      resourceGroup = new ResourceGroupSplicer(repo);
    });

    it('ok with empty repo', () => {
      const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repo);

      toTearDown.push(
        repoOnDidSplice(({ index, deleteCount, elements }) => {
          expect(index).toBe(0);
          expect(deleteCount).toBe(0);
          expect(elements.length).toBe(0);
        }),
      );

      resourceGroup.run();
    });

    it('ok when initialize', () => {
      const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repo);

      const spliceListener = jest.fn();
      toTearDown.push(repoOnDidSplice(spliceListener));

      resourceGroup.run();
      expect(spliceListener).toHaveBeenCalledTimes(1);

      provider.registerGroup(new MockSCMResourceGroup(provider, 1));

      expect(spliceListener).toHaveBeenCalledTimes(2);
      expect(spliceListener.mock.calls[1][0].target.provider).toBe(provider);
      expect(spliceListener.mock.calls[1][0].index).toBe(0);
      expect(spliceListener.mock.calls[1][0].deleteCount).toBe(0);
      expect(spliceListener.mock.calls[1][0].elements.length).toBe(1);
      expect((spliceListener.mock.calls[1][0].elements[0] as ISCMResourceGroup).id).toBe('scm_resource_group_1');

      resourceGroup.dispose();
      expect(spliceListener).toHaveBeenCalledTimes(3);
      expect(spliceListener.mock.calls[2][0].target.provider).toBe(provider);
      expect(spliceListener.mock.calls[2][0].index).toBe(0);
      expect(spliceListener.mock.calls[2][0].deleteCount).toBe(1);
      expect(spliceListener.mock.calls[2][0].elements).toEqual([]);
    });

    it('group onChange when updateHideWhenEmpty', () => {
      const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repo);

      const spliceListener = jest.fn();
      toTearDown.push(repoOnDidSplice(spliceListener));

      resourceGroup.run();
      expect(spliceListener).toHaveBeenCalledTimes(1);

      const scmResourceGroup = new MockSCMResourceGroup(provider, 1);
      provider.registerGroup(scmResourceGroup);

      expect(spliceListener).toHaveBeenCalledTimes(2);

      // 更新 hideWhenEmpty 触发一次 group.onChange
      scmResourceGroup.updateHideWhenEmpty(true);

      // hideWhenEmpty#true 则会导致该分组被溢出
      expect(spliceListener).toHaveBeenCalledTimes(3);
      expect(spliceListener.mock.calls[2][0].target.provider).toBe(provider);
      expect(spliceListener.mock.calls[2][0].index).toBe(0);
      expect(spliceListener.mock.calls[2][0].deleteCount).toBe(1);
      expect(spliceListener.mock.calls[2][0].elements).toEqual([]);
    });

    it('ok with group splice', () => {
      const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repo);

      const spliceListener = jest.fn();
      toTearDown.push(repoOnDidSplice(spliceListener));

      resourceGroup.run();
      expect(spliceListener).toHaveBeenCalledTimes(1);

      const scmResourceGroup = new MockSCMResourceGroup(provider, 1);
      provider.registerGroup(scmResourceGroup);
      expect(spliceListener).toHaveBeenCalledTimes(2);

      const scmResource = new MockSCMResource(scmResourceGroup, undefined, undefined, undefined);
      scmResourceGroup.splice(0, 0, [scmResource]);

      expect(spliceListener).toHaveBeenCalledTimes(3);
      expect(spliceListener.mock.calls[2][0].target.provider).toBe(provider);
      expect(spliceListener.mock.calls[2][0].index).toBe(1);
      expect(spliceListener.mock.calls[2][0].deleteCount).toBe(0);
      expect(spliceListener.mock.calls[2][0].elements.length).toBe(1);
      expect((spliceListener.mock.calls[2][0].elements[0] as ISCMResource).resourceGroup.id).toBe(
        'scm_resource_group_1',
      );

      // 继续添加一个 scm resource
      scmResourceGroup.splice(0, 0, [new MockSCMResource(scmResourceGroup, undefined, undefined, undefined)]);
      expect(spliceListener).toHaveBeenCalledTimes(4);
      // 删除一个 scmResource
      scmResourceGroup.splice(0, 1, []);
      expect(spliceListener).toHaveBeenCalledTimes(5);
      expect(spliceListener.mock.calls[4][0].target.provider).toBe(provider);
      expect(spliceListener.mock.calls[4][0].index).toBe(1);
      expect(spliceListener.mock.calls[4][0].deleteCount).toBe(1);
      expect(spliceListener.mock.calls[4][0].elements.length).toBe(0);

      // 删除最后一个 scmResource
      scmResourceGroup.splice(0, 1, []);
      expect(spliceListener).toHaveBeenCalledTimes(6);

      // 更新 hideWhenEmpty 触发一次 group.onChange
      scmResourceGroup.updateHideWhenEmpty(true);
      expect(spliceListener).toHaveBeenCalledTimes(7);
    });
  });
});
