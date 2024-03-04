import { Injectable, Injector, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  AINativeConfigService,
  BrowserModule,
  IAiInlineChatService,
} from '@opensumi/ide-core-browser';

import { IAINativeService } from '../common/index';

import { AINativeService } from './ai-chat.service';
import { AiNativeBrowserContribution } from './ai-core.contribution';
import { InlineChatFeatureRegistry } from './inline-chat-widget/inline-chat.feature.registry';
import { AiInlineChatService } from './inline-chat-widget/inline-chat.service';
import { AiNativeCoreContribution, IInlineChatFeatureRegistry } from './types';

@Injectable()
export class AINativeModule extends BrowserModule {
  contributionProvider = AiNativeCoreContribution;
  providers: Provider[] = [
    AiNativeBrowserContribution,
    {
      token: IInlineChatFeatureRegistry,
      useClass: InlineChatFeatureRegistry,
    },
    {
      token: IAINativeService,
      useClass: AINativeService,
    },
    {
      token: IAiInlineChatService,
      useClass: AiInlineChatService,
    },
  ];

  preferences = (injector: Injector) => {
    const aiNativeConfig: AINativeConfigService = injector.get(AINativeConfigService);
    aiNativeConfig.enable();
  };

  backServices = [
    {
      servicePath: AIBackSerivcePath,
      token: AIBackSerivceToken,
    },
  ];
}
