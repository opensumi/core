import { Autowired } from '@opensumi/di';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { Domain } from '@opensumi/ide-core-common';
import { IElectronMainApi } from '@opensumi/ide-core-common/lib/electron';

import { IHelloService } from '../../../common/types';

interface IHelloMainService extends IElectronMainApi<string>, IHelloService {}

@Domain(ClientAppContribution)
export class DemoContribution implements ClientAppContribution {
  @Autowired(IHelloService)
  helloService: IHelloMainService;

  initialize() {
    this.helloService.on('hello-event', (payload) => {
      // eslint-disable-next-line no-console
      console.log('Got payload from Main Process:', payload);
    });

    // Demo
    setTimeout(() => {
      this.helloService.hello();
    }, 2000);
  }
}
