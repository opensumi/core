import { Injectable, Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { ClientAppContribution, getIcon } from '@opensumi/ide-core-browser';
import { SCMService } from '@opensumi/ide-scm';

// mock implements
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '@opensumi/ide-scm/__tests__/scm-test-util';
import { IMenuRegistry, MenuContribution } from '@opensumi/ide-core-browser/lib/menu/next';

@Injectable()
@Domain(ClientAppContribution, MenuContribution)
export class SCMProviderContribution implements ClientAppContribution, MenuContribution {
  @Autowired(SCMService)
  private readonly scmService: SCMService;

  async initialize() {
    const mockProvider0 = new MockSCMProvider(0);
    // prepare data
    const mockSCMResourceGroup0 = new MockSCMResourceGroup(mockProvider0, 0);
    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [
      new MockSCMResource(mockSCMResourceGroup0, 'a.ts', 'diffable', undefined),
    ]);

    mockProvider0.groups.splice(mockProvider0.groups.elements.length, 0, [mockSCMResourceGroup0]);
    mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [
      new MockSCMResource(mockSCMResourceGroup0, 'b.ts', 'whatever', undefined),
    ]);
    this.scmService.registerSCMProvider(mockProvider0);
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    // inline
    menuRegistry.registerMenuItem(
      'scm/resourceState/context',
      {
        command: {
          id: 'editor.action.quickCommand',
          label: 'quick-open',
        },
        iconClass: getIcon('open'),
        group: 'inline@1',
        when: 'scmResourceState == diffable',
      },
    );

    menuRegistry.registerMenuItem(
      'scm/resourceState/context',
      {
        command: {
          id: 'core.about',
          label: '关于 Kaitian',
        },
        when: 'scmResourceState == whatever',
        iconClass: getIcon('bell'),
        group: 'inline@2',
      },
    );

    // context menu
    menuRegistry.registerMenuItem(
      'scm/resourceState/context',
      {
        command: {
          id: 'editor.action.quickCommand',
          label: 'quick-open',
        },
        group: 'navigation',
        when: 'scmResourceState == diffable',
      },
    );

    menuRegistry.registerMenuItem(
      'scm/resourceState/context',
      {
        command: {
          id: 'core.about',
          label: '关于 Kaitian',
        },
        group: 'navigation',
        when: 'scmResourceState == whatever',
      },
    );
  }
}
