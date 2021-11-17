import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@ide-framework/common-di';
import { ElectronMainModule } from '@ide-framework/ide-core-electron-main/lib/electron-main-module';
import { IHelloService } from 'common/types';
import { HelloContribution, HelloService } from './hello';

@Injectable()
export class MainModule extends ElectronMainModule {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  providers = [
    {
      token: IHelloService,
      useClass: HelloService,
    },
    HelloContribution,
  ];

}
