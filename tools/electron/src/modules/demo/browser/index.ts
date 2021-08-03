import { Injectable } from '@ali/common-di';
import { createElectronMainApi } from '@ali/ide-core-browser';
import { ElectronBasicModule } from '@ali/ide-electron-basic/lib/browser';
import { IHelloService } from '../../../common/types';
import { DemoContribution } from './demo';

@Injectable()
export class DemoModule extends ElectronBasicModule {

  providers = [
    {
      token: IHelloService,
      useValue: createElectronMainApi(IHelloService),
    },
    DemoContribution,
  ];
}
