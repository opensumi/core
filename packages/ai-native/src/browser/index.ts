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

import { ChatProxyServiceToken, IChatAgentService, IChatInternalService, IChatManagerService } from '../common';

import { AINativeBrowserContribution } from './ai-core.contribution';
import { ChatAgentService } from './chat/chat-agent.service';
import { ChatAgentViewService } from './chat/chat-agent.view.service';
import { ChatManagerService } from './chat/chat-manager.service';
import { ChatProxyService } from './chat/chat-proxy.service';
import { ChatService } from './chat/chat.api.service';
import { ChatFeatureRegistry } from './chat/chat.feature.registry';
import { ChatInternalService } from './chat/chat.internal.service';
import { ChatRenderRegistry } from './chat/chat.render.registry';
import { AICodeActionContribution } from './contrib/code-action/code-action.contribution';
import { InterfaceNavigationContribution } from './contrib/interface-navigation/interface-navigation.contribution';
import { MergeConflictContribution } from './contrib/merge-conflict';
import { ResolveConflictRegistry } from './contrib/merge-conflict/merge-conflict.feature.registry';
import { RenameCandidatesProviderRegistry } from './contrib/rename/rename.feature.registry';
import { TerminalAIContribution } from './contrib/terminal/terminal-ai.contributon';
import { TerminalFeatureRegistry } from './contrib/terminal/terminal.feature.registry';
import { LanguageParserService } from './languages/service';
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
    AICodeActionContribution,
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
