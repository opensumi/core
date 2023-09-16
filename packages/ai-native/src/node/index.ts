import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { AiGPTBackSerivcePath, AiGPTBackSerivceToken } from '../common';

import { AiGPTBackService } from './ai-gpt.back.service';

@Injectable()
export class AiNativeModule extends NodeModule {
  providers: Provider[] = [
    {
      token: AiGPTBackSerivceToken,
      useClass: AiGPTBackService,
    },
  ];

  backServices = [
    {
      servicePath: AiGPTBackSerivcePath,
      token: AiGPTBackSerivceToken,
    },
  ];
}
