import { Injectable, Provider } from '@opensumi/di';
import { AiBackSerivcePath, AiBackSerivceToken } from '@opensumi/ide-core-common/lib/ai-native';
import { BaseAiBackService as AiBackService } from '@opensumi/ide-core-common/lib/ai-native/base-back.service';
import { NodeModule } from '@opensumi/ide-core-node';

// import { AiBackService } from './ai-gpt.back.service';

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
