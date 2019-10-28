import { Uri } from '@ali/ide-core-common';

import { SCMService } from '../../src/common';
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';

import { isSCMResource, getSCMResourceContextKey, getSCMRepositoryDesc } from '../../src/browser/scm-util';

// tslint:disable-next-line: new-parens
const mockSCMResourceGroup = new MockSCMResourceGroup(1);

// tslint:disable-next-line: new-parens
const mockSCMResource = new MockSCMResource(mockSCMResourceGroup);

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
