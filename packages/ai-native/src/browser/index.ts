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
import {
  IntelligentCompletionsRegistryToken,
  ProblemFixRegistryToken,
  TerminalRegistryToken,
} from '@opensumi/ide-core-common';

import {
  ChatProxyServiceToken,
  IAIInlineCompletionsProvider,
  IChatAgentService,
  IChatInternalService,
  IChatManagerService,
  SumiMCPServerProxyServicePath,
  TokenMCPServerProxyService,
} from '../common';
import { LLMContextServiceToken } from '../common/llm-context';
import { MCPServerManager, MCPServerManagerPath } from '../common/mcp-server-manager';
import { ChatAgentPromptProvider, DefaultChatAgentPromptProvider } from '../common/prompts/context-prompt-provider';

import { AINativeBrowserContribution } from './ai-core.contribution';
import { ApplyService } from './chat/apply.service';
import { ChatAgentService } from './chat/chat-agent.service';
import { ChatAgentViewService } from './chat/chat-agent.view.service';
import { ChatManagerService } from './chat/chat-manager.service';
import { ChatProxyService } from './chat/chat-proxy.service';
import { ChatService } from './chat/chat.api.service';
import { ChatFeatureRegistry } from './chat/chat.feature.registry';
import { ChatInternalService } from './chat/chat.internal.service';
import { ChatRenderRegistry } from './chat/chat.render.registry';
import { LlmContextContribution } from './context/llm-context.contribution';
import { LLMContextServiceImpl } from './context/llm-context.service';
import { AICodeActionContribution } from './contrib/code-action/code-action.contribution';
import { AIInlineCompletionsProvider } from './contrib/inline-completions/completeProvider';
import { IntelligentCompletionsContribution } from './contrib/intelligent-completions/intelligent-completions.contribution';
import { IntelligentCompletionsRegistry } from './contrib/intelligent-completions/intelligent-completions.feature.registry';
import { InterfaceNavigationContribution } from './contrib/interface-navigation/interface-navigation.contribution';
import { MergeConflictContribution } from './contrib/merge-conflict';
import { ResolveConflictRegistry } from './contrib/merge-conflict/merge-conflict.feature.registry';
import { ProblemFixProviderRegistry } from './contrib/problem-fix/problem-fix.feature.registry';
import { RenameCandidatesProviderRegistry } from './contrib/rename/rename.feature.registry';
import { TerminalAIContribution } from './contrib/terminal/terminal-ai.contributon';
import { TerminalFeatureRegistry } from './contrib/terminal/terminal.feature.registry';
import { LanguageParserService } from './languages/service';
import { BaseApplyService } from './mcp/base-apply.service';
import { MCPConfigCommandContribution } from './mcp/config/mcp-config.commands';
import { MCPConfigContribution } from './mcp/config/mcp-config.contribution';
import { MCPServerProxyService } from './mcp/mcp-server-proxy.service';
import { MCPServerRegistry } from './mcp/mcp-server.feature.registry';
import { CreateNewFileWithTextTool } from './mcp/tools/createNewFileWithText';
import { EditFileTool } from './mcp/tools/editFile';
import { FileSearchTool } from './mcp/tools/fileSearch';
import { GetDiagnosticsByPathTool } from './mcp/tools/getDiagnosticsByPath';
import { GetOpenEditorFileDiagnosticsTool } from './mcp/tools/getOpenEditorFileDiagnostics';
import { GrepSearchTool } from './mcp/tools/grepSearch';
import { ListDirTool } from './mcp/tools/listDir';
import { ReadFileTool } from './mcp/tools/readFile';
import { RunTerminalCommandTool } from './mcp/tools/runTerminalCmd';
import { AINativePreferencesContribution } from './preferences';
import { AINativeCoreContribution, MCPServerContribution, TokenMCPServerRegistry } from './types';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { InlineChatService } from './widget/inline-chat/inline-chat.service';
import { InlineDiffService } from './widget/inline-diff';

@Injectable()
export class AINativeModule extends BrowserModule {
  @Autowired(AINativeConfigService)
  protected readonly aiNativeConfig: AINativeConfigService;

  constructor() {
    super();
    this.aiNativeConfig.setAINativeModuleLoaded(true);
  }

  contributionProvider = [AINativeCoreContribution, MCPServerContribution];
  providers: Provider[] = [
    AINativeBrowserContribution,
    InterfaceNavigationContribution,
    TerminalAIContribution,
    MergeConflictContribution,
    AICodeActionContribution,
    AINativePreferencesContribution,
    IntelligentCompletionsContribution,
    MCPConfigContribution,
    MCPConfigCommandContribution,

    // MCP Server Contributions START
    ListDirTool,
    ReadFileTool,
    EditFileTool,
    CreateNewFileWithTextTool,
    GetOpenEditorFileDiagnosticsTool,
    FileSearchTool,
    GrepSearchTool,
    GetDiagnosticsByPathTool,
    RunTerminalCommandTool,
    // MCP Server Contributions END

    // Context Service
    LlmContextContribution,
    {
      token: LLMContextServiceToken,
      useClass: LLMContextServiceImpl,
    },

    {
      token: TokenMCPServerRegistry,
      useClass: MCPServerRegistry,
    },
    {
      token: TokenMCPServerProxyService,
      useClass: MCPServerProxyService,
    },
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
      useClass: InlineChatService,
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
      token: ProblemFixRegistryToken,
      useClass: ProblemFixProviderRegistry,
    },
    {
      token: TerminalRegistryToken,
      useClass: TerminalFeatureRegistry,
    },
    {
      token: LanguageParserService,
      useClass: LanguageParserService,
    },
    {
      token: IAIInlineCompletionsProvider,
      useClass: AIInlineCompletionsProvider,
    },
    {
      token: InlineDiffService,
      useClass: InlineDiffService,
    },
    {
      token: ChatAgentPromptProvider,
      useClass: DefaultChatAgentPromptProvider,
    },
    {
      token: BaseApplyService,
      useClass: ApplyService,
    },
  ];

  backServices = [
    {
      servicePath: AIBackSerivcePath,
      token: AIBackSerivceToken,
      clientToken: ChatProxyServiceToken,
    },
    {
      servicePath: MCPServerManagerPath,
      token: MCPServerManager,
    },
    {
      clientToken: TokenMCPServerProxyService,
      servicePath: SumiMCPServerProxyServicePath,
    },
  ];
}
