import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { AiGPTBackSerivcePath, AiGPTBackSerivceToken, IAiChatService } from '../common';

import { AiNativeBackService } from './ai-gpt.back.service';

@Injectable()
export class AiNativeModule extends NodeModule {
  providers: Provider[] = [
    {
      token: AiGPTBackSerivceToken,
      useClass: AiNativeBackService,
      // useClass: class {},
    },
  ];

  backServices = [
    {
      servicePath: AiGPTBackSerivcePath,
      token: AiGPTBackSerivceToken,
    },
  ];
}
