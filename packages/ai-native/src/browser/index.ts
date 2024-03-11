import { Injectable, Provider } from '@opensumi/di';
import { AIBackSerivcePath, AIBackSerivceToken, BrowserModule, IAIInlineChatService } from '@opensumi/ide-core-browser';

import { IAINativeService, IAiChatService, IChatAgentService, IChatManagerService } from '../common';

import { AINativeBrowserContribution } from './ai-core.contribution';
import { AINativeService } from './ai-native.service';
import { AiChatService } from './chat/ai-chat.service';
import { ChatAgentService } from './chat/chat-agent.service';
import { ChatAgentViewService } from './chat/chat-agent.view.service';
import { ChatManagerService } from './chat/chat-manager.service';
import { AINativeCoreContribution, IChatAgentViewService, IInlineChatFeatureRegistry } from './types';
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
      token: IAiChatService,
      useClass: AiChatService,
    },
  ];

  backServices = [
    {
      servicePath: AIBackSerivcePath,
      token: AIBackSerivceToken,
      clientToken: IAiChatService,
    },
  ];
}
