import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  Domain,
  IPreferenceSettingsService,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';

import { WorkspaceTrustSettingPanel } from './workspace-trust-setting-panel';

@Domain(ClientAppContribution)
export class WorkspaceTrustSettingsContribution implements ClientAppContribution {
  @Autowired(IPreferenceSettingsService)
  private readonly preferenceSettingsService: IPreferenceSettingsService;

  onStart() {
    this.preferenceSettingsService.registerSettingGroup({
      id: 'workspace-trust',
      title: localize('workspace.trust.settings.group.title', 'Workspace Trust'),
      iconClass: getIcon('shield'),
    });

    this.preferenceSettingsService.registerSettingSection('workspace-trust', {
      title: localize('workspace.trust.settings.section.title', 'Trust Management'),
      component: WorkspaceTrustSettingPanel,
    });
  }
}
