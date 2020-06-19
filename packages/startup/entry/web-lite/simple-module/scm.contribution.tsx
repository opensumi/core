import { Injectable, Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { SCMService } from '@ali/ide-scm';

// mock implements
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '@ali/ide-scm/__tests__/scm-test-util';

@Injectable()
@Domain(ClientAppContribution)
export class SCMContribution implements ClientAppContribution {
  @Autowired(SCMService)
  private readonly scmService: SCMService;

  async initialize() {
    const mockProvider0 = new MockSCMProvider(0);
    // prepare data
    const mockSCMResourceGroup0 = new MockSCMResourceGroup(mockProvider0, 0);
    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [new MockSCMResource(mockSCMResourceGroup0, 'a.ts')]);

    mockProvider0.groups.splice(mockProvider0.groups.elements.length, 0, [mockSCMResourceGroup0]);
    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [new MockSCMResource(mockSCMResourceGroup0, 'b.ts')]);
    this.scmService.registerSCMProvider(mockProvider0);
  }
}
