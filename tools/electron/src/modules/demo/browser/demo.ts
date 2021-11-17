import { Autowired } from '@ide-framework/common-di';
import { ClientAppContribution } from '@ide-framework/ide-core-browser';
import { Domain } from '@ide-framework/ide-core-common';
import { IElectronMainApi } from '@ide-framework/ide-core-common/lib/electron';
import { IHelloService } from '../../../common/types';

interface IHelloMainService extends IElectronMainApi<string>, IHelloService { }

@Domain(ClientAppContribution)
export class DemoContribution implements ClientAppContribution {

  @Autowired(IHelloService)
  helloService: IHelloMainService;

  initialize() {
    this.helloService.on('hello-event', (payload) => {
      console.log('Got payload from Main Process:', payload);
    });

    // Demo
    setTimeout(() => {
      this.helloService.hello();
    }, 2000);
  }
}
