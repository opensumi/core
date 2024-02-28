import { Injectable, Provider } from '@opensumi/di';
import { AiBackSerivcePath, AiBackSerivceToken } from '@opensumi/ide-core-common';
import { NodeModule } from '@opensumi/ide-core-node';
import { BaseAiBackService } from '@opensumi/ide-core-node/lib/ai-native/base-back.service';

@Injectable()
export class AiNativeModule extends NodeModule {
  providers: Provider[] = [
    {
      token: AiBackSerivceToken,
      useClass: BaseAiBackService,
    },
  ];

  backServices = [
    {
      servicePath: AiBackSerivcePath,
      token: AiBackSerivceToken,
    },
  ];
}
