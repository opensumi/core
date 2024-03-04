import { Injectable, Injector, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  AINativeConfigService,
  BrowserModule,
  IAIInlineChatService,
} from '@opensumi/ide-core-browser';

import { IAINativeService } from '../common/index';

import { AINativeBrowserContribution } from './ai-core.contribution';
import { AINativeService } from './ai-native.service';
import { InlineChatFeatureRegistry } from './inline-chat-widget/inline-chat.feature.registry';
import { AIInlineChatService } from './inline-chat-widget/inline-chat.service';
import { IAINativeCoreContribution, IInlineChatFeatureRegistry } from './types';

@Injectable()
export class AINativeModule extends BrowserModule {
  contributionProvider = IAINativeCoreContribution;
  providers: Provider[] = [
    AINativeBrowserContribution,
    {
      token: IInlineChatFeatureRegistry,
      useClass: InlineChatFeatureRegistry,
    },
    {
      token: IAINativeService,
      useClass: AINativeService,
    },
    {
      token: IAIInlineChatService,
      useClass: AIInlineChatService,
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
