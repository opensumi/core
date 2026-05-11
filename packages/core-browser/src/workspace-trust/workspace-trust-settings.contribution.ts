import { Autowired, Injectable } from '@opensumi/di';
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
      title: '%workspace.trust.settings.group.title%',
      iconClass: getIcon('shield'),
    });

    this.preferenceSettingsService.registerSettingSection('workspace-trust', {
      title: '%workspace.trust.settings.section.title%',
      component: WorkspaceTrustSettingPanel,
    });
  }
}
