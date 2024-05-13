import { Injectable, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  BrowserModule,
  ChatAgentViewServiceToken,
  ChatFeatureRegistryToken,
  ChatRenderRegistryToken,
  ChatServiceToken,
  IAIInlineChatService,
  InlineChatFeatureRegistryToken,
  RenameCandidatesProviderRegistryToken,
  ResolveConflictRegistryToken,
} from '@opensumi/ide-core-browser';
import { TerminalRegistryToken } from '@opensumi/ide-core-common';

import {
  ChatProxyServiceToken,
  IAINativeService,
  IChatAgentService,
  IChatInternalService,
  IChatManagerService,
} from '../common';

import { AINativeBrowserContribution } from './ai-core.contribution';
import { AINativeService } from './ai-native.service';
import { TerminalAIContribution } from './ai-terminal/terminal-ai.contributon';
import { TerminalFeatureRegistry } from './ai-terminal/terminal.feature.registry';
import { ChatAgentService } from './chat/chat-agent.service';
import { ChatAgentViewService } from './chat/chat-agent.view.service';
import { ChatManagerService } from './chat/chat-manager.service';
import { ChatProxyService } from './chat/chat-proxy.service';
import { ChatService } from './chat/chat.api.service';
import { ChatFeatureRegistry } from './chat/chat.feature.registry';
import { ChatInternalService } from './chat/chat.internal.service';
import { ChatRenderRegistry } from './chat/chat.render.registry';
import { InterfaceNavigationContribution } from './interface-navigation/interface-navigation.contribution';
import { LanguageParserService } from './languages/service';
import { MergeConflictContribution } from './merge-conflict';
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
    InterfaceNavigationContribution,
    TerminalAIContribution,
    MergeConflictContribution,
    {
      token: InlineChatFeatureRegistryToken,
      useClass: InlineChatFeatureRegistry,
    },
    {
      token: ChatFeatureRegistryToken,
      useClass: ChatFeatureRegistry,
    },
    {
      token: ChatRenderRegistryToken,
      useClass: ChatRenderRegistry,
    },
    {
      token: ResolveConflictRegistryToken,
      useClass: ResolveConflictRegistry,
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
      token: IChatInternalService,
      useClass: ChatInternalService,
    },
    {
      token: ChatProxyServiceToken,
      useClass: ChatProxyService,
    },
    {
      token: ChatServiceToken,
      useClass: ChatService,
    },
    {
      token: RenameCandidatesProviderRegistryToken,
      useClass: RenameCandidatesProviderRegistry,
    },
    {
      token: TerminalRegistryToken,
      useClass: TerminalFeatureRegistry,
    },
    {
      token: LanguageParserService,
      useClass: LanguageParserService,
    },
  ];

  backServices = [
    {
      servicePath: AIBackSerivcePath,
      token: AIBackSerivceToken,
      clientToken: ChatProxyServiceToken,
    },
  ];
}
