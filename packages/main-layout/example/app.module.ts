import { Autowired, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { StatusBarService, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';

@Injectable()
export class AppLogicModule extends BrowserModule {

  slotMap: SlotMap = new Map();

  @Autowired()
  statusBarService: StatusBarService;

  active() {
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
