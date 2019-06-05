import { Autowired, Injectable } from '@ali/common-di';
import { ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { StatusBarService, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';

@Injectable()
@Domain(ClientAppContribution)
export class AppLogicContribution implements ClientAppContribution {

  @Autowired()
  statusBarService: StatusBarService;

  onStart() {
    this.statusBarService.addElement('kaitian', {
      text: 'kaitian',
      icon: 'info-circle',
      alignment: StatusBarAlignment.LEFT,
      priority: 100,
      onClick: () => {
        alert('hello ide :)');
      },
    });
  }
}
