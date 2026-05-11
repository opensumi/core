import { Autowired } from '@opensumi/di';
import { localize } from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { ClientAppContribution } from '../common/common.define';
import { IPreferenceSettingsService } from '../preferences/settings';
import { getIcon } from '../style/icon/icon';

import { WorkspaceTrustSettingPanel } from './workspace-trust-setting-panel';

@Domain(ClientAppContribution)
export class WorkspaceTrustSettingsContribution implements ClientAppContribution {
  @Autowired(IPreferenceSettingsService)
  private readonly preferenceSettingsService: IPreferenceSettingsService;

  onStart() {
    this.preferenceSettingsService.registerSettingGroup({
      id: 'workspace-trust',
      title: localize('workspace.trust.settings.group.title'),
      iconClass: getIcon('shield'),
    });

    this.preferenceSettingsService.registerSettingSection('workspace-trust', {
      title: localize('workspace.trust.settings.section.title'),
      component: WorkspaceTrustSettingPanel,
    });
  }
}
