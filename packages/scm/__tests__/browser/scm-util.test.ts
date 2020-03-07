import { Uri } from '@ali/ide-core-common';

import { SCMService } from '../../src';
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';

import { isSCMResource, getSCMResourceContextKey, getSCMRepositoryDesc } from '../../src/browser/scm-util';

describe('test for scm-util', () => {
  const mockSCMProvider = new MockSCMProvider(0);
  const mockSCMResourceGroup = new MockSCMResourceGroup(mockSCMProvider, 1);
  const mockSCMResource = new MockSCMResource(mockSCMResourceGroup);

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

    const repo = scmService.registerSCMProvider(mockSCMProvider);
    expect(getSCMRepositoryDesc(repo)).toEqual({
      title: 'scm_label_0',
      type: '',
    });

    const mockSCMProvider1 = new MockSCMProvider(1);
    mockSCMProvider1.rootUri = Uri.file('/test/workspace');

    const repo1 = scmService.registerSCMProvider(mockSCMProvider1);

    expect(getSCMRepositoryDesc(repo1)).toEqual({
      title: 'workspace',
      type: 'scm_label_1',
    });
  });
});
