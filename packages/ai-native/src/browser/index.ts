import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { AiChatContribution } from './ai-chat.contribution';
import { AiGPTBackSerivcePath, AiGPTBackSerivceToken } from '../common';

@Injectable()
export class AiNativeModule extends BrowserModule {
  providers: Provider[] = [
    AiChatContribution
  ];

  backServices = [
    {
      servicePath: AiGPTBackSerivcePath,
      token: AiGPTBackSerivceToken,
    },
  ];
}
