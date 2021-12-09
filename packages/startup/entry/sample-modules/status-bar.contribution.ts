import { Injectable, Autowired } from '@opensumi/di';
import { ClientAppContribution, Domain, IStatusBarService, StatusBarAlignment } from '@opensumi/ide-core-browser';
import { IconType } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

@Injectable()
@Domain(ClientAppContribution)
export class StatusBarContribution implements ClientAppContribution {

  @Autowired(IconService)
  private iconService: IconService;

  @Autowired(IStatusBarService)
  private statusBarService: IStatusBarService;

  onDidStart() {
    this.statusBarService.addElement('OpenSumi', {
      backgroundColor: 'var(--button-background)',
      color: '#FFFFFF',
      tooltip: 'OpenSumi',
      alignment: StatusBarAlignment.LEFT,
      iconClass: this.iconService.fromIcon('', 'https://img.alicdn.com/imgextra/i1/O1CN01I0fKZ51PTgHByjznG_!!6000000001842-2-tps-40-40.png', IconType.Mask),
      priority: Infinity,
    });
  }

}
