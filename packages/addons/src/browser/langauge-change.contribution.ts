import { Autowired } from '@opensumi/di';
import { Domain, ClientAppContribution, PreferenceService, IClientApp, localize } from '@opensumi/ide-core-browser';
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
    this.preferenceService.onPreferenceChanged(async (change) => {
      if (change.preferenceName === 'general.language') {
        const shouldAsk = this.preferenceService.get('general.askReloadOnLanguageChange');
        if (shouldAsk) {
          const msg = await this.dialogService.info(
            localize('preference.general.language.change.refresh.info', '更改语言后需重启后生效，是否立即刷新?'),
            [
              localize('preference.general.language.change.refresh.later', '稍后自己刷新'),
              localize('preference.general.language.change.refresh.now', '立即刷新'),
            ],
          );
          if (msg === localize('preference.general.language.change.refresh.now', '立即刷新')) {
            this.clientApp.fireOnReload();
          }
        }
      }
    });
  }
}
