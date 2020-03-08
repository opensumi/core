import { Event } from '@ali/ide-core-common';
import { Injector } from '@ali/common-di';
import { IContextKeyService } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';

import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

import { SCMService, ISCMProvider, ISCMResourceGroup, ISCMResource, ISCMRepository } from '../../src';
import { ViewModelContext, ResourceGroupSplicer } from '../../src/browser/scm-model';

describe('test for scm.store.ts', () => {
  describe('ViewModelContext', () => {
    let provider1: ISCMProvider;
    let provider2: ISCMProvider;
    let repo1: ISCMRepository;
    let repo2: ISCMRepository;
    let store: ViewModelContext;
    let scmService: SCMService;

    let injector: MockInjector;

    beforeEach(() => {
      injector = createBrowserInjector([], new Injector([
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        SCMService,
      ]));

      provider1 = new MockSCMProvider(1, 'git');
      provider2 = new MockSCMProvider(2, 'svn');

      scmService = injector.get(SCMService);
      store = injector.get(ViewModelContext);
    });

    it('ViewModelContext: already contains repos', () => {
      scmService.registerSCMProvider(provider1);
      scmService.registerSCMProvider(provider2);

      injector.addProviders(ViewModelContext);
      store = injector.get(ViewModelContext);

      expect(store.repoList.length).toBe(2);
      expect(store['scmProviderCtxKey'].get()).toBe('git');
      expect(store.repoList[0].provider).toEqual(provider1);
      expect(store.repoList[1].provider).toEqual(provider2);

      repo1.dispose();
      expect(store.repoList.length).toBe(1);
      expect(store.repoList[0].provider).toEqual(provider2);
      expect(store['scmProviderCtxKey'].get()).toBe('svn');

      repo2.dispose();
      expect(store.repoList.length).toBe(0);
      expect(store['scmProviderCtxKey'].get()).toBe(undefined);
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

        repo2 = scmService.registerSCMProvider(provider2);
        expect(store.repoList.length).toBe(2);
        expect(store.repoList[0].provider).toEqual(provider1);
        expect(store['scmProviderCtxKey'].get()).toBe('git');

        // 无效的重复添加
        // (store as any).addRepo(repo1);
        // expect(warnSpy).toBeCalledTimes(1);
        // expect(warnSpy.mock.calls[0][0]).toBe('duplicate scm repo');

        repo1.dispose();
        expect(store.repoList.length).toBe(1);
        expect(store.repoList[0].provider).toEqual(provider2);
        expect(store['scmProviderCtxKey'].get()).toBe('svn');

        repo2.dispose();
        expect(store.repoList.length).toBe(0);
        expect(store['scmProviderCtxKey'].get()).toBe(undefined);

        // 无效的重复删除
        // (store as any).deleteRepo(repo2);
        // expect(warnSpy).toBeCalledTimes(2);
        // expect(warnSpy.mock.calls[1][0]).toBe('no such scm repo');
      });

      it('changeSelectedRepos', () => {
        repo1 = scmService.registerSCMProvider(provider1);
        repo2 = scmService.registerSCMProvider(provider2);

        expect(store['scmProviderCtxKey'].get()).toBe('git');

        repo1.setSelected(false);
        repo2.setSelected(true);
        expect(store.selectedRepos).toEqual([repo2]);
        expect(store['scmProviderCtxKey'].get()).toBe('svn');

        repo2.setSelected(false);
        repo1.setSelected(true);
        expect(store.selectedRepos).toEqual([repo1]);
        expect(store['scmProviderCtxKey'].get()).toBe('sgit');
      });

      it('spliceSCMList', () => {
        const mockResourceGroup = new MockSCMResourceGroup(provider1, 0);
        const mockResource = new MockSCMResource(mockResourceGroup);

        store.spliceSCMList(0, 0, mockResourceGroup, mockResource);
        expect(store.scmList).toEqual([mockResourceGroup, mockResource]);

        const mockResourceGroup1 = new MockSCMResourceGroup(provider1, 1);
        store.spliceSCMList(1, 1, mockResourceGroup1);
        expect(store.scmList).toEqual([mockResourceGroup, mockResourceGroup1]);
      });

      it('getSCMMenuService', () => {
        expect(store.getSCMMenuService(undefined)).toBeUndefined();

        expect(store.getSCMMenuService(repo1)).toBeUndefined();
        expect(store.getSCMMenuService(repo2)).toBeUndefined();

        repo1 = scmService.registerSCMProvider(provider1);
        repo2 = scmService.registerSCMProvider(provider2);

        expect(store.getSCMMenuService(repo1)).not.toBeUndefined();
        expect(store.getSCMMenuService(repo2)).not.toBeUndefined();

        repo1.dispose();
        expect(store.getSCMMenuService(repo1)).toBeUndefined();

        repo2.dispose();
        expect(store.getSCMMenuService(repo2)).toBeUndefined();
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

      repoOnDidSplice(({ index, deleteCount, elements }) => {
        expect(index).toBe(0);
        expect(deleteCount).toBe(0);
        expect(elements.length).toBe(0);
      });

      resourceGroup.run();
    });

    it('ok when initialize', () => {
      const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repo);

      const spliceListener = jest.fn();
      repoOnDidSplice(spliceListener);

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
      repoOnDidSplice(spliceListener);

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
      repoOnDidSplice(spliceListener);

      resourceGroup.run();
      expect(spliceListener).toHaveBeenCalledTimes(1);

      const scmResourceGroup = new MockSCMResourceGroup(provider, 1);
      provider.registerGroup(scmResourceGroup);
      expect(spliceListener).toHaveBeenCalledTimes(2);

      const scmResource = new MockSCMResource(scmResourceGroup);
      scmResourceGroup.splice(0, 0, [scmResource]);

      expect(spliceListener).toHaveBeenCalledTimes(3);
      expect(spliceListener.mock.calls[2][0].target.provider).toBe(provider);
      expect(spliceListener.mock.calls[2][0].index).toBe(1);
      expect(spliceListener.mock.calls[2][0].deleteCount).toBe(0);
      expect(spliceListener.mock.calls[2][0].elements.length).toBe(1);
      expect((spliceListener.mock.calls[2][0].elements[0] as ISCMResource).resourceGroup.id).toBe('scm_resource_group_1');

      // 继续添加一个 scm resource
      scmResourceGroup.splice(0, 0, [new MockSCMResource(scmResourceGroup)]);
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
