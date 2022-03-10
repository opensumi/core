import { Injectable } from '@opensumi/di';
import { createElectronMainApi } from '@opensumi/ide-core-browser';
import { ElectronBasicModule } from '@opensumi/ide-electron-basic/lib/browser';

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
