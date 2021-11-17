import { Injectable } from '@ide-framework/common-di';
import { createElectronMainApi } from '@ide-framework/ide-core-browser';
import { ElectronBasicModule } from '@ide-framework/ide-electron-basic/lib/browser';
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
