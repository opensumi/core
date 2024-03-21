import { Injectable, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  BrowserModule,
  ChatAgentViewServiceToken,
  ChatFeatureRegistryToken,
  IAIInlineChatService,
  InlineChatFeatureRegistryToken,
  RenameCandidatesProviderRegistryToken,
  ResolveConflictRegistryToken,
} from '@opensumi/ide-core-browser';

import { IAIChatService, IAINativeService, IChatAgentService, IChatManagerService } from '../common';

import { AINativeBrowserContribution } from './ai-core.contribution';
import { AINativeService } from './ai-native.service';
import { ChatAgentService } from './chat/chat-agent.service';
import { ChatAgentViewService } from './chat/chat-agent.view.service';
import { ChatManagerService } from './chat/chat-manager.service';
import { ChatFeatureRegistry } from './chat/chat.feature.registry';
import { ChatService } from './chat/chat.service';
import { AIMenuBarContribution } from './layout/menu-bar/menu-bar.contribution';
import { ResolveConflictRegistry } from './merge-conflict/merge-conflict.feature.registry';
import { RenameCandidatesProviderRegistry } from './rename/rename.feature.registry';
import { AINativeCoreContribution } from './types';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { AIInlineChatService } from './widget/inline-chat/inline-chat.service';

@Injectable()
export class AINativeModule extends BrowserModule {
  contributionProvider = AINativeCoreContribution;
  providers: Provider[] = [
    AINativeBrowserContribution,
    AIMenuBarContribution,
    {
      token: InlineChatFeatureRegistryToken,
      useClass: InlineChatFeatureRegistry,
    },
    {
      token: ChatFeatureRegistryToken,
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
      token: ChatAgentViewServiceToken,
      useClass: ChatAgentViewService,
    },
    {
      token: IAIChatService,
      useClass: ChatService,
    },
    {
      token: ResolveConflictRegistryToken,
      useClass: ResolveConflictRegistry,
    },
    {
      token: RenameCandidatesProviderRegistryToken,
      useClass: RenameCandidatesProviderRegistry,
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
