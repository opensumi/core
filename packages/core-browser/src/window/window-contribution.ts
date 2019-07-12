import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common';
import { ClientApp } from '../bootstrap/app';
import { WindowService } from './window-service';
import { ClientAppContribution } from '../common';

@Domain(ClientAppContribution)
export class WindowContribution implements ClientAppContribution {
  @Autowired(WindowService)
  windowService: WindowService;

  onStart(app: ClientApp): void {
    this.windowService.setApplication(app);
    window.addEventListener('beforeunload', (event) => {
        if (!this.windowService.canUnload()) {
            event.returnValue = '';
            event.preventDefault();
            return '';
        }
    });
  }
}
