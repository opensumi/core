import { Autowired } from '@opensumi/di';
import {
  Domain,
  ClientAppContribution,
  PreferenceService,
  IClientApp,
  localize,
  GeneralSettingsId,
  setLanguageId,
} from '@opensumi/ide-core-browser';
import { IDialogService } from '@opensumi/ide-overlay';

@Domain(ClientAppContribution)
export class LanguageChangeHintContribution implements ClientAppContribution {
  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(IClientApp)
  clientApp: IClientApp;

  @Autowired(IDialogService)
  dialogService: IDialogService;

  onStart() {
    this.preferenceService.onSpecificPreferenceChange(GeneralSettingsId.Language, async (change) => {
      const shouldAsk = this.preferenceService.get('general.askReloadOnLanguageChange');
      if (shouldAsk) {
        const msg = await this.dialogService.info(
          localize(
            'preference.general.language.change.refresh.info',
            'After changing the language, it should be restarted to take effect. Will it be refreshed immediately?',
          ),
          [
            localize('preference.general.language.change.refresh.later', 'Later'),
            localize('preference.general.language.change.refresh.now', 'Now'),
          ],
        );
        if (msg === localize('preference.general.language.change.refresh.now', 'Now')) {
          this.clientApp.fireOnReload();
        }
      }
    });
  }
}
