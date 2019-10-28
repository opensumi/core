import { Event } from '@ali/ide-core-common';

import { SCMService, ISCMProvider, ISCMResourceGroup, ISCMResource, ISCMRepository } from '../../src/common';
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';

import { ViewModelContext, ResourceGroupSplicer } from '../../src/browser/scm.store';

describe('test for scm.store.ts', () => {
  describe('ViewModelContext', () => {
    let provider1: ISCMProvider;
    let provider2: ISCMProvider;
    let repo1: ISCMRepository;
    let repo2: ISCMRepository;
    let store: ViewModelContext;
    beforeEach(() => {
      const scmService = new SCMService();
      provider1 = new MockSCMProvider(1);
      provider2 = new MockSCMProvider(2);

      repo1 = scmService.registerSCMProvider(provider1);
      repo2 = scmService.registerSCMProvider(provider2);

      store = new ViewModelContext();
    });

    it('addRepo/deleteRepo', () => {
      store.addRepo(repo1);
      expect(store.repoList.length).toBe(1);
      expect(store.repoList[0].provider).toEqual(provider1);

      store.addRepo(repo2);
      expect(store.repoList.length).toBe(2);
      expect(store.repoList[0].provider).toEqual(provider1);

      store.deleteRepo(repo1);
      expect(store.repoList.length).toBe(1);
      expect(store.repoList[0].provider).toEqual(provider2);

      store.deleteRepo(repo2);
      expect(store.repoList.length).toBe(0);
    });

    it('changeSelectedRepos', () => {
      store.addRepo(repo1);
      store.addRepo(repo2);

      store.changeSelectedRepos([repo2]);
      expect(store.selectedRepos).toEqual([repo2]);

      store.changeSelectedRepos([repo1]);
      expect(store.selectedRepos).toEqual([repo1]);
    });

    it('spliceSCMList', () => {
      const mockResourceGroup = new MockSCMResourceGroup(0);
      const mockResource = new MockSCMResource(mockResourceGroup);

      store.spliceSCMList(0, 0, mockResourceGroup, mockResource);
      expect(store.scmList).toEqual([mockResourceGroup, mockResource]);

      const mockResourceGroup1 = new MockSCMResourceGroup(1);
      store.spliceSCMList(1, 1, mockResourceGroup1);
      expect(store.scmList).toEqual([mockResourceGroup, mockResourceGroup1]);
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

      provider.registerGroup(new MockSCMResourceGroup(1));

      expect(spliceListener).toHaveBeenCalledTimes(2);
      expect(spliceListener.mock.calls[1][0].target.provider).toBe(provider);
      expect(spliceListener.mock.calls[1][0].index).toBe(0);
      expect(spliceListener.mock.calls[1][0].deleteCount).toBe(0);
      expect(spliceListener.mock.calls[1][0].elements.length).toBe(1);
      expect((spliceListener.mock.calls[1][0].elements[0] as ISCMResourceGroup).id).toBe('scm_resource_group_1');
    });

    it('group onChange when updateHideWhenEmpty', () => {
      const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repo);

      const spliceListener = jest.fn();
      repoOnDidSplice(spliceListener);

      resourceGroup.run();
      expect(spliceListener).toHaveBeenCalledTimes(1);

      const scmResourceGroup = new MockSCMResourceGroup(1);
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

      const scmResourceGroup = new MockSCMResourceGroup(1);
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
