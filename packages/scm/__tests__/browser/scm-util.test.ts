import { SCMService } from '../../src';
import { isSCMResource, getSCMResourceGroupContextValue, getSCMRepositoryDesc } from '../../src/browser/scm-util';
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';


describe('test for scm-util', () => {
  const mockSCMProvider = new MockSCMProvider(0);
  const mockSCMResourceGroup = new MockSCMResourceGroup(mockSCMProvider, 1);
  const mockSCMResource = new MockSCMResource(mockSCMResourceGroup, undefined, undefined, undefined);

  it('isSCMResource', () => {
    expect(isSCMResource(mockSCMResourceGroup)).toBeFalsy();
    expect(isSCMResource(mockSCMResource)).toBeTruthy();
  });

  it('getSCMResourceContextKey', () => {
    expect(getSCMResourceGroupContextValue(mockSCMResourceGroup)).toBe('scm_resource_group_1');
    expect(getSCMResourceGroupContextValue(mockSCMResource)).toBe('scm_resource_group_1');
  });

  it('getSCMRepositoryDesc', () => {
    const scmService = new SCMService();

    const repo = scmService.registerSCMProvider(mockSCMProvider);
    expect(getSCMRepositoryDesc(repo)).toEqual({
      title: 'workspace',
      type: 'scm_label_0',
    });

    const mockSCMProvider1 = new MockSCMProvider(1);
    mockSCMProvider1.rootUri = undefined;

    const repo1 = scmService.registerSCMProvider(mockSCMProvider1);

    expect(getSCMRepositoryDesc(repo1)).toEqual({
      title: 'scm_label_1',
      type: '',
    });
  });
});
