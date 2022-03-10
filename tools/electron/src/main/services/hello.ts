/* eslint-disable no-console */
import { IHelloService } from 'common/types';

import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import {
  ElectronMainApiProvider,
  ElectronMainApiRegistry,
  ElectronMainContribution,
} from '@opensumi/ide-core-electron-main/lib/bootstrap/types';

@Injectable()
export class HelloService extends ElectronMainApiProvider implements IHelloService {
  async hello() {
    console.log('-------------------------- hello service. ---------------------');

    this.eventEmitter.fire('hello-event', {
      content: 'from main process.',
    });
  }
}

@Domain(ElectronMainContribution)
export class HelloContribution implements ElectronMainContribution {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerMainApi(registry: ElectronMainApiRegistry) {
    registry.registerMainApi(IHelloService, this.injector.get(IHelloService));
  }
}
