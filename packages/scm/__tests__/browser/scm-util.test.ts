import { Uri, Event } from '@ali/ide-core-common';
import { ISplice } from '@ali/ide-core-common/src/sequence';

import { isSCMResource, getSCMResourceContextKey, getSCMRepositoryDesc } from '../../src/browser/scm-util';
import { SCMService, ISCMProvider, ISCMResourceGroup, ISCMResource } from '../../src/common';

import { MockSCMProvider } from '../scm-test-util';

// tslint:disable-next-line: new-parens
const mockSCMResourceGroup = new class implements ISCMResourceGroup {
  readonly provider: ISCMProvider;
  readonly label = 'test_scm_resource_group';
  readonly id = 'scm_resource_group_1';
  readonly hideWhenEmpty = false;
  readonly onDidChange: Event<void> = Event.None;
  readonly elements: ISCMResource[] = [];
  readonly onDidSplice: Event<ISplice<ISCMResource>> = Event.None;
  toJSON: () => { $mid: 4 };
};

// tslint:disable-next-line: new-parens
const mockSCMResource = new class implements ISCMResource {
  readonly resourceGroup = mockSCMResourceGroup;
  readonly sourceUri = Uri.file('/test/workspace');
  readonly decorations: {};
  async open() {}
  toJSON: () => { $mid: 3 };
};

describe('test for scm-util', () => {
  it('isSCMResource', () => {
    expect(isSCMResource(mockSCMResourceGroup)).toBeFalsy();
    expect(isSCMResource(mockSCMResource)).toBeTruthy();
  });

  it('getSCMResourceContextKey', () => {
    expect(getSCMResourceContextKey(mockSCMResourceGroup)).toBe('scm_resource_group_1');
    expect(getSCMResourceContextKey(mockSCMResource)).toBe('scm_resource_group_1');
  });

  it('getSCMRepositoryDesc', () => {
    const scmService = new SCMService();

    const repo = scmService.registerSCMProvider(new MockSCMProvider(0));
    expect(getSCMRepositoryDesc(repo)).toEqual({
      title: 'scm_label_0',
      type: '',
    });

    const mockSCMProvider = new MockSCMProvider(1);
    mockSCMProvider.rootUri = Uri.file('/test/workspace');

    const repo1 = scmService.registerSCMProvider(mockSCMProvider);

    expect(getSCMRepositoryDesc(repo1)).toEqual({
      title: 'workspace',
      type: 'scm_label_1',
    });
  });
});
