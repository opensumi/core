import { Autowired, Injectable, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  AINativeConfigService,
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
import { IntelligentCompletionsRegistryToken, TerminalRegistryToken } from '@opensumi/ide-core-common';

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
import { IntelligentCompletionsRegistry } from './contrib/intelligent-completions/intelligent-completions.feature.registry';
import { InterfaceNavigationContribution } from './contrib/interface-navigation/interface-navigation.contribution';
import { MergeConflictContribution } from './contrib/merge-conflict';
import { ResolveConflictRegistry } from './contrib/merge-conflict/merge-conflict.feature.registry';
import { RenameCandidatesProviderRegistry } from './contrib/rename/rename.feature.registry';
import { TerminalAIContribution } from './contrib/terminal/terminal-ai.contributon';
import { TerminalFeatureRegistry } from './contrib/terminal/terminal.feature.registry';
import { LanguageParserService } from './languages/service';
import { AINativePreferencesContribution } from './preferences';
import { AINativeCoreContribution } from './types';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { AIInlineChatService } from './widget/inline-chat/inline-chat.service';

@Injectable()
export class AINativeModule extends BrowserModule {
  @Autowired(AINativeConfigService)
  protected readonly aiNativeConfig: AINativeConfigService;

  constructor() {
    super();
    this.aiNativeConfig.setAINativeModuleLoaded(true);
  }

  contributionProvider = AINativeCoreContribution;
  providers: Provider[] = [
    AINativeBrowserContribution,
    InterfaceNavigationContribution,
    TerminalAIContribution,
    MergeConflictContribution,
    AICodeActionContribution,
    AINativePreferencesContribution,
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
      token: IntelligentCompletionsRegistryToken,
      useClass: IntelligentCompletionsRegistry,
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
