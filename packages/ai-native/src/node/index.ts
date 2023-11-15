import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { AiBackSerivcePath, AiBackSerivceToken } from '../common';

import { AiBackService } from './ai.service';

@Injectable()
export class AiNativeModule extends NodeModule {
  providers: Provider[] = [
    {
      token: AiBackSerivceToken,
      useClass: AiBackService,
    },
  ];

  backServices = [
    {
      servicePath: AiBackSerivcePath,
      token: AiBackSerivceToken,
    },
  ];
}
