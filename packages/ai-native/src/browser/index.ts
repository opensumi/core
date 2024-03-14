import { Injectable, Provider } from '@opensumi/di';
import { AIBackSerivcePath, AIBackSerivceToken, BrowserModule, IAIInlineChatService } from '@opensumi/ide-core-browser';

import { IAIChatService, IAINativeService, IChatAgentService, IChatManagerService } from '../common';

import { AINativeBrowserContribution } from './ai-core.contribution';
import { AINativeService } from './ai-native.service';
import { ChatAgentService } from './chat/chat-agent.service';
import { ChatAgentViewService } from './chat/chat-agent.view.service';
import { ChatManagerService } from './chat/chat-manager.service';
import { ChatFeatureRegistry } from './chat/chat.feature.registry';
import { ChatService } from './chat/chat.service';
import {
  AINativeCoreContribution,
  IChatAgentViewService,
  IChatFeatureRegistry,
  IInlineChatFeatureRegistry,
} from './types';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { AIInlineChatService } from './widget/inline-chat/inline-chat.service';

@Injectable()
export class AINativeModule extends BrowserModule {
  contributionProvider = AINativeCoreContribution;
  providers: Provider[] = [
    AINativeBrowserContribution,
    {
      token: IInlineChatFeatureRegistry,
      useClass: InlineChatFeatureRegistry,
    },
    {
      token: IChatFeatureRegistry,
      useClass: ChatFeatureRegistry,
    },
    {
      token: IAINativeService,
      useClass: AINativeService,
    },
    {
      token: IAIInlineChatService,
      useClass: AIInlineChatService,
    },
    {
      token: IChatManagerService,
      useClass: ChatManagerService,
    },
    {
      token: IChatAgentService,
      useClass: ChatAgentService,
    },
    {
      token: IChatAgentViewService,
      useClass: ChatAgentViewService,
    },
    {
      token: IAIChatService,
      useClass: ChatService,
    },
  ];

  backServices = [
    {
      servicePath: AIBackSerivcePath,
      token: AIBackSerivceToken,
      clientToken: IAIChatService,
    },
  ];
}
