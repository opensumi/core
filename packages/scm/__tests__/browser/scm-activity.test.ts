import { Injectable, Injector } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

import { SCMService } from '../../src/common';
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';

import { SCMBadgeController } from '../../src/browser/scm-activity';

jest.useFakeTimers();

describe('test for packages/menu-bar/src/browser/menu-bar.store.ts', () => {
  let injector: MockInjector;

  let scmBadgeController: SCMBadgeController;
  let scmService: SCMService;

  let fakeSetBadge: jest.Mock;

  beforeEach(() => {
    fakeSetBadge = jest.fn();

    @Injectable()
    class MockMainLayoutService {
      getTabbarHandler() {
        return {
          setBadge: fakeSetBadge,
        };
      }
    }

    injector = createBrowserInjector([], new Injector([
      {
        token: IMainLayoutService,
        useClass: MockMainLayoutService,
      },
      SCMService,
    ]));

    injector.addProviders(SCMBadgeController);

    scmBadgeController = injector.get(SCMBadgeController);

    scmService = injector.get(SCMService);
  });

  afterEach(() => {
    fakeSetBadge.mockReset();
  });

  it('ok for no repo', () => {
    scmBadgeController.start();
    expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked
  });

  it('ok for one repo', () => {
    scmBadgeController.start();
    expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked

    const repo0 = scmService.registerSCMProvider(new MockSCMProvider(0));
    expect(fakeSetBadge).toHaveBeenCalledTimes(1); // non-invoke

    // dispose
    repo0.dispose();
    expect(fakeSetBadge).toHaveBeenCalledWith('');
  });

  it('ok for repo provider.count changes', () => {
    scmBadgeController.start();
    expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked

    const mockProvider0 = new MockSCMProvider(0);
    mockProvider0.count = 1;
    const repo0 = scmService.registerSCMProvider(mockProvider0);
    mockProvider0.didChangeEmitter.fire();
    expect(fakeSetBadge).toHaveBeenCalledWith('1');

    mockProvider0.count = 2;
    mockProvider0.didChangeResourcesEmitter.fire();
    expect(fakeSetBadge).toHaveBeenCalledWith('2');

    // remove repo
    repo0.dispose();
    expect(fakeSetBadge).toHaveBeenCalledWith('');
  });

  it('ok for repo provider.groups.elements.length changes', () => {
    scmBadgeController.start();
    expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked

    const mockProvider0 = new MockSCMProvider(0);
    // prepare data
    const mockSCMResourceGroup0 = new MockSCMResourceGroup(0);
    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [new MockSCMResource(mockSCMResourceGroup0)]);

    mockProvider0.groups.splice(mockProvider0.groups.elements.length, 0, [mockSCMResourceGroup0]);
    const repo0 = scmService.registerSCMProvider(mockProvider0);
    mockProvider0.didChangeResourcesEmitter.fire();
    expect(fakeSetBadge).toHaveBeenCalledWith('1');

    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [new MockSCMResource(mockSCMResourceGroup0)]);
    mockProvider0.didChangeEmitter.fire();
    expect(fakeSetBadge).toHaveBeenCalledWith('2');

    // remove repo
    repo0.dispose();
    expect(fakeSetBadge).toHaveBeenCalledWith('');
  });
});
