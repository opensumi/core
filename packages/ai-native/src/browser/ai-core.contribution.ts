import React from 'react';

import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  AINativeConfigService,
  AINativeSettingSectionsId,
  AI_NATIVE_SETTING_GROUP_ID,
  AppConfig,
  COMMON_COMMANDS,
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  ComponentContribution,
  ComponentRegistry,
  ComponentRegistryImpl,
  ContributionProvider,
  Domain,
  IAIInlineChatService,
  IEditorExtensionContribution,
  IPreferenceSettingsService,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
  MonacoContribution,
  PreferenceSchemaProvider,
  PreferenceService,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
  TabbarBehaviorConfig,
  getIcon,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';
import {
  AI_AGENTIC_WORKBENCH_IS_VISIBLE,
  AI_AGENTIC_WORKBENCH_TOGGLE,
  AI_CHAT_VISIBLE,
  AI_INLINE_CHAT_INTERACTIVE_INPUT_CANCEL,
  AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE,
  AI_INLINE_CHAT_VISIBLE,
  AI_INLINE_COMPLETION_REPORTER,
  AI_INLINE_COMPLETION_VISIBLE,
  AI_INLINE_DIFF_PARTIAL_EDIT,
  AI_PANEL_LAYOUT_GET,
  AI_PANEL_LAYOUT_SET,
  AI_PANEL_LAYOUT_TOGGLE,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import {
  InlineChatIsVisible,
  InlineDiffPartialEditsIsVisible,
  InlineHintWidgetIsVisible,
  InlineInputWidgetIsStreaming,
  InlineInputWidgetIsVisible,
} from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  AIBackSerivcePath,
  AI_NATIVE_SETTING_GROUP_TITLE,
  ChatFeatureRegistryToken,
  ChatInputRegistryToken,
  ChatRenderRegistryToken,
  ChatServiceToken,
  ChatViewRegistryToken,
  CommandService,
  IACPConfigProvider,
  IAIBackService,
  IDisposable,
  ILogger,
  InlineChatFeatureRegistryToken,
  IntelligentCompletionsRegistryToken,
  MCPConfigServiceToken,
  PanelLayoutMode,
  PreferenceScope,
  ProblemFixRegistryToken,
  RenameCandidatesProviderRegistryToken,
  ResolveConflictRegistryToken,
  STORAGE_NAMESPACE,
  StorageProvider,
  TerminalRegistryToken,
  URI,
  WebMcpGroupRegistryToken,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';
import { IEditor, WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  IEditorDocumentModelContentRegistry,
  IEditorFeatureRegistry,
  MultiDiffSourceContribution,
} from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { IMultiDiffSourceResolverService } from '@opensumi/ide-editor/lib/common/multi-diff';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IMessageService } from '@opensumi/ide-overlay';
import { ISettingRegistry, SettingContribution } from '@opensumi/ide-preferences';
import { EditorContributionInstantiation } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorExtensions';
import { HideInlineCompletion } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/controller/commands';
import { SyncDescriptor } from '@opensumi/monaco-editor-core/esm/vs/platform/instantiation/common/descriptors';

import {
  AI_CHAT_CONTAINER_ID,
  AI_CHAT_LOGO_AVATAR_ID,
  AI_CHAT_VIEW_ID,
  AI_MENU_BAR_DEBUG_TOOLBAR,
  BUILTIN_MCP_SERVER_NAME,
  ChatProxyServiceToken,
  IChatInternalService,
  IChatManagerService,
  ISumiMCPServerBackend,
  SumiMCPServerProxyServicePath,
  anthropicModels,
  deepSeekModels,
  openAiNativeModels,
} from '../common';
import { LLMContextService, LLMContextServiceToken } from '../common/llm-context';
import { MCPServerDescription, MCPServersDisabledKey } from '../common/mcp-server-manager';
import { MCP_SERVER_TYPE } from '../common/types';

import { AgenticWorkspaceSwitchService } from './acp/agentic-workspace-switch.service';
import { AcpChatInput } from './acp/components/AcpChatInput';
import { AcpChatMentionInput } from './acp/components/AcpChatMentionInput';
import { AcpQueuedTurnEditor } from './acp/components/AcpQueuedTurnEditor';
import { WebMcpGroupRegistry } from './acp/webmcp-group-registry';
import { createAcpChatGroup } from './acp/webmcp-groups/acp-chat.webmcp-group';
import { createDiagnosticsGroup } from './acp/webmcp-groups/diagnostics.webmcp-group';
import { createEditorGroup } from './acp/webmcp-groups/editor.webmcp-group';
import { createFileGroup } from './acp/webmcp-groups/file.webmcp-group';
import { createOpenSumiMcpGroup } from './acp/webmcp-groups/opensumi-mcp.webmcp-group';
import { createSearchGroup } from './acp/webmcp-groups/search.webmcp-group';
import { createTerminalGroup } from './acp/webmcp-groups/terminal.webmcp-group';
import { createWorkspaceGroup } from './acp/webmcp-groups/workspace.webmcp-group';
import { registerWebMcpModelContextTools } from './acp/webmcp-model-context-adapter';
import { AI_CHAT_INPUT_TOGGLE_EXPANDED } from './chat/acp-chat-input.commands';
import { AI_CHAT_NEW_CHAT, AI_CHAT_NEW_TASK } from './chat/acp-new-draft.commands';
import { ChatEditSchemeDocumentProvider } from './chat/chat-edit-resource';
import { ChatManagerService } from './chat/chat-manager.service';
import { ChatMultiDiffResolver } from './chat/chat-multi-diff-source';
import { ChatProxyService } from './chat/chat-proxy.service';
import { ChatService } from './chat/chat.api.service';
import { IChatInputRegistry } from './chat/chat.input.registry';
import { ChatInternalService } from './chat/chat.internal.service';
import { AcpChatInternalService } from './chat/chat.internal.service.acp';
import { AIChatView } from './chat/chat.view';
import { AIChatViewACP } from './chat/chat.view.acp';
import { IChatViewRegistry } from './chat/chat.view.registry';
import { getAvailableAgentConfigs } from './chat/get-default-agent-type';
import { ChatInput } from './components/ChatInput';
import { ChatMentionInput } from './components/ChatMentionInput';
import { CodeActionSingleHandler } from './contrib/code-action/code-action.handler';
import { AIInlineCompletionsProvider } from './contrib/inline-completions/completeProvider';
import { InlineCompletionsController } from './contrib/inline-completions/inline-completions.controller';
import { AICompletionsService } from './contrib/inline-completions/service/ai-completions.service';
import { IntelligentCompletionsController } from './contrib/intelligent-completions/intelligent-completions.controller';
import { ProblemFixController } from './contrib/problem-fix/problem-fix.controller';
import { RenameSingleHandler } from './contrib/rename/rename.handler';
import { AIRunToolbar } from './contrib/run-toolbar/run-toolbar';
import { registerAgenticWorkbenchRevealCommandInterceptors } from './layout/agentic-workbench-command-reveal';
import { AIPanelLayoutService, AI_PANEL_LAYOUT_CONTEXT, AI_PANEL_LAYOUT_MENU } from './layout/panel-layout.service';
import {
  AIChatTabRenderer,
  AIChatTabRendererWithTab,
  AILeftTabRenderer,
  AIRightTabRenderer,
} from './layout/tabbar.view';
import { AIChatLogoAvatar } from './layout/view/avatar/avatar.view';
import { BaseApplyService } from './mcp/base-apply.service';
import { MCPConfigService } from './mcp/config/mcp-config.service';
import {
  AINativeCoreContribution,
  IChatFeatureRegistry,
  IChatRenderRegistry,
  IIntelligentCompletionsRegistry,
  IMCPServerRegistry,
  IProblemFixProviderRegistry,
  IRenameCandidatesProviderRegistry,
  IResolveConflictRegistry,
  ITerminalProviderRegistry,
  MCPServerContribution,
  TokenMCPServerRegistry,
} from './types';
import { InlineChatEditorController } from './widget/inline-chat/inline-chat-editor.controller';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { InlineChatService } from './widget/inline-chat/inline-chat.service';
import { InlineDiffManager } from './widget/inline-diff/inline-diff-manager';
import { InlineDiffController } from './widget/inline-diff/inline-diff.controller';
import { InlineHintController } from './widget/inline-hint/inline-hint.controller';
import { InlineInputController } from './widget/inline-input/inline-input.controller';
import { InlineInputService } from './widget/inline-input/inline-input.service';
import { InlineStreamDiffService } from './widget/inline-stream-diff/inline-stream-diff.service';
import { SumiLightBulbWidget } from './widget/light-bulb';

export const INLINE_DIFF_MANAGER_WIDGET_ID = 'inline-diff-manager-widget';

const DynamicChatViewWrapper: React.FC = () => {
  const chatViewRegistry = useInjectable<IChatViewRegistry>(ChatViewRegistryToken);
  const activeView = chatViewRegistry.getActiveChatView();
  if (!activeView) {
    return null;
  }
  return React.createElement(activeView.component);
};

@Domain(
  ClientAppContribution,
  BrowserEditorContribution,
  CommandContribution,
  SettingContribution,
  KeybindingContribution,
  ComponentContribution,
  SlotRendererContribution,
  MenuContribution,
  MonacoContribution,
  MultiDiffSourceContribution,
)
export class AINativeBrowserContribution
  implements
    ClientAppContribution,
    BrowserEditorContribution,
    CommandContribution,
    SettingContribution,
    KeybindingContribution,
    ComponentContribution,
    SlotRendererContribution,
    MenuContribution,
    MonacoContribution,
    MultiDiffSourceContribution
{
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: IBrowserCtxMenu;

  @Autowired(AINativeCoreContribution)
  private readonly contributions: ContributionProvider<AINativeCoreContribution>;

  @Autowired(MCPServerContribution)
  private readonly mcpServerContributions: ContributionProvider<MCPServerContribution>;

  @Autowired(TokenMCPServerRegistry)
  private readonly mcpServerRegistry: IMCPServerRegistry;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  @Autowired(ChatFeatureRegistryToken)
  private readonly chatFeatureRegistry: IChatFeatureRegistry;

  @Autowired(ChatRenderRegistryToken)
  private readonly chatRenderRegistry: IChatRenderRegistry;

  @Autowired(ChatInputRegistryToken)
  private readonly chatInputRegistry: IChatInputRegistry;

  @Autowired(IChatInternalService)
  private readonly aiChatService: AcpChatInternalService;

  @Autowired(ChatViewRegistryToken)
  private readonly chatViewRegistry: IChatViewRegistry;

  @Autowired(ResolveConflictRegistryToken)
  private readonly resolveConflictRegistry: IResolveConflictRegistry;

  @Autowired(RenameCandidatesProviderRegistryToken)
  private readonly renameCandidatesProviderRegistry: IRenameCandidatesProviderRegistry;

  @Autowired(TerminalRegistryToken)
  private readonly terminalProviderRegistry: ITerminalProviderRegistry;

  @Autowired(IntelligentCompletionsRegistryToken)
  private readonly intelligentCompletionsRegistry: IIntelligentCompletionsRegistry;

  @Autowired(ProblemFixRegistryToken)
  private readonly problemFixProviderRegistry: IProblemFixProviderRegistry;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(IACPConfigProvider)
  private readonly acpConfigProvider: IACPConfigProvider;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(DesignLayoutConfig)
  private readonly designLayoutConfig: DesignLayoutConfig;

  @Autowired(AIPanelLayoutService)
  private readonly panelLayoutService: AIPanelLayoutService;

  @Autowired(AgenticWorkspaceSwitchService)
  private readonly agenticWorkspaceSwitchService: AgenticWorkspaceSwitchService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(AICompletionsService)
  private readonly aiCompletionsService: AICompletionsService;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(PreferenceSchemaProvider)
  private preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IPreferenceSettingsService)
  private preferenceSettings: IPreferenceSettingsService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(ChatProxyServiceToken)
  private readonly chatProxyService: ChatProxyService;

  @Autowired(IAIInlineChatService)
  private readonly aiInlineChatService: InlineChatService;

  @Autowired(InlineInputService)
  private readonly inlineInputService: InlineInputService;

  @Autowired(InlineStreamDiffService)
  private readonly inlineStreamDiffService: InlineStreamDiffService;

  @Autowired(RenameSingleHandler)
  private readonly renameSingleHandler: RenameSingleHandler;

  @Autowired(CodeActionSingleHandler)
  private readonly codeActionSingleHandler: CodeActionSingleHandler;

  @Autowired(SumiMCPServerProxyServicePath)
  private readonly sumiMCPServerBackendProxy: ISumiMCPServerBackend;

  @Autowired(MCPConfigServiceToken)
  private readonly mcpConfigService: MCPConfigService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(IChatManagerService)
  private readonly chatManagerService: ChatManagerService;

  @Autowired(IChatInternalService)
  private readonly chatInternalService: ChatInternalService;

  @Autowired(BaseApplyService)
  private readonly applyService: BaseApplyService;

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(ChatServiceToken)
  private readonly chatService: ChatService;

  @Autowired(LLMContextServiceToken)
  private readonly llmContextService: LLMContextService;

  @Autowired()
  private readonly chatEditResourceProvider: ChatEditSchemeDocumentProvider;

  @Autowired()
  private readonly chatMultiDiffResolver: ChatMultiDiffResolver;

  private webMcpModelContextDisposable: IDisposable | undefined;

  constructor() {
    this.registerFeature();
  }

  registerMultiDiffSourceResolver(resolverService: IMultiDiffSourceResolverService): IDisposable {
    return resolverService.registerResolver(this.chatMultiDiffResolver);
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry): void {
    registry.registerEditorDocumentModelContentProvider(this.chatEditResourceProvider);
  }

  async initialize() {
    this.panelLayoutService.initialize();

    const { supportsChatAssistant, supportsAgentMode } = this.aiNativeConfigService.capabilities;

    if (supportsChatAssistant) {
      ComponentRegistryImpl.addLayoutModule(this.appConfig.layoutConfig, AI_CHAT_VIEW_ID, AI_CHAT_CONTAINER_ID);
      ComponentRegistryImpl.addLayoutModule(this.appConfig.layoutConfig, DESIGN_MENU_BAR_RIGHT, AI_CHAT_LOGO_AVATAR_ID);
      this.chatProxyService.registerDefaultAgent();

      // Local 模式：立即初始化
      // ACP 模式：延迟到面板打开时初始化
      if (!supportsAgentMode) {
        this.chatInternalService.init();
        this.chatManagerService.init();
      }
    }
  }

  registerEditorExtensionContribution(register: IEditorExtensionContribution<any[]>): void {
    const { supportsInlineChat, supportsInlineCompletion, supportsProblemFix, supportsCodeAction } =
      this.aiNativeConfigService.capabilities;

    register(
      InlineDiffController.ID,
      new SyncDescriptor(InlineDiffController, [this.injector]),
      EditorContributionInstantiation.Lazy,
    );

    if (supportsCodeAction) {
      register(SumiLightBulbWidget.ID, SumiLightBulbWidget, EditorContributionInstantiation.Lazy);
    }

    if (supportsInlineChat) {
      register(
        InlineChatEditorController.ID,
        new SyncDescriptor(InlineChatEditorController, [this.injector]),
        EditorContributionInstantiation.BeforeFirstInteraction,
      );

      if (this.inlineInputService.getInteractiveInputHandler()) {
        register(
          InlineHintController.ID,
          new SyncDescriptor(InlineHintController, [this.injector]),
          EditorContributionInstantiation.AfterFirstRender,
        );
        register(
          InlineInputController.ID,
          new SyncDescriptor(InlineInputController, [this.injector]),
          EditorContributionInstantiation.AfterFirstRender,
        );
      }
    }
    if (supportsInlineCompletion) {
      register(
        IntelligentCompletionsController.ID,
        new SyncDescriptor(IntelligentCompletionsController, [this.injector]),
        EditorContributionInstantiation.Eager,
      );
      register(
        InlineCompletionsController.ID,
        new SyncDescriptor(InlineCompletionsController, [this.injector]),
        EditorContributionInstantiation.AfterFirstRender,
      );
    }
    if (supportsProblemFix) {
      register(
        ProblemFixController.ID,
        new SyncDescriptor(ProblemFixController, [this.injector]),
        EditorContributionInstantiation.AfterFirstRender,
      );
    }
  }

  onReconnect(): void {
    const { supportsMCP } = this.aiNativeConfigService.capabilities;
    if (supportsMCP) {
      this.initMCPServers();
    }
  }

  onDidStart() {
    this.registerWebMcpSurface();

    runWhenIdle(() => {
      const {
        supportsAgentMode,
        supportsRenameSuggestions,
        supportsInlineChat,
        supportsMCP,
        supportsCustomLLMSettings,
      } = this.aiNativeConfigService.capabilities;
      const prefChatVisibleType = this.preferenceService.getValid(AINativeSettingSectionsId.ChatVisibleType);

      if (prefChatVisibleType === 'always') {
        this.commandService.executeCommand(AI_CHAT_VISIBLE.id, true);
      } else if (prefChatVisibleType === 'never') {
        this.commandService.executeCommand(AI_CHAT_VISIBLE.id, false);
      }

      if (supportsRenameSuggestions) {
        this.renameSingleHandler.load();
      }

      if (supportsInlineChat) {
        this.codeActionSingleHandler.load();
      }

      if (supportsCustomLLMSettings) {
        this.preferenceService.onSpecificPreferenceChange(AINativeSettingSectionsId.LLMModelSelection, (change) => {
          const model = this.getModelByName(change.newValue);
          // support modelIds
          const modelIds = model ? Object.keys(model) : [];
          const defaultModelId = modelIds.length ? modelIds[0] : '';
          const currentSchemas = this.preferenceSchemaProvider.getPreferenceProperty(AINativeSettingSectionsId.ModelID);
          this.preferenceSchemaProvider.setSchema(
            {
              properties: {
                [AINativeSettingSectionsId.ModelID]: {
                  ...currentSchemas,
                  default: defaultModelId,
                  defaultValue: defaultModelId,
                  enum: modelIds.length ? modelIds : undefined,
                },
              },
            },
            true,
          );
          this.preferenceService.set(AINativeSettingSectionsId.ModelID, defaultModelId, change.scope);
          this.preferenceSettings.setEnumLabels(
            AINativeSettingSectionsId.ModelID,
            modelIds.reduce((obj, item) => ({ ...obj, [item]: item }), {}),
          );
        });
        this.preferenceService.onSpecificPreferenceChange(AINativeSettingSectionsId.ModelID, (change) => {
          const model = this.preferenceService.get<string>(AINativeSettingSectionsId.LLMModelSelection);
          if (!model) {
            return;
          }
          const modelInfo = this.getModelByName(model);
          if (modelInfo && modelInfo[change.newValue]) {
            this.preferenceService.set(
              AINativeSettingSectionsId.MaxTokens,
              modelInfo[change.newValue].maxTokens,
              change.scope,
            );
            this.preferenceService.set(
              AINativeSettingSectionsId.ContextWindow,
              modelInfo[change.newValue].contextWindow,
              change.scope,
            );
          }
        });
      }

      if (supportsMCP) {
        this.initMCPServers();
      }

      if (supportsAgentMode) {
        this.warmUpDefaultAcpPool();
      }
    });
  }

  onStop() {
    this.webMcpModelContextDisposable?.dispose();
  }

  private warmUpDefaultAcpPool(): void {
    const warmUpAgentPool = this.aiBackService.warmUpAgentPool;
    const resolvePrewarmConfig = this.acpConfigProvider.resolvePrewarmConfig;
    if (!warmUpAgentPool || !resolvePrewarmConfig) {
      return;
    }

    void resolvePrewarmConfig
      .call(this.acpConfigProvider)
      .then(
        async (config) => {
          if (!config) {
            return;
          }
          await warmUpAgentPool.call(this.aiBackService, config);
        },
        (error) => {
          this.logger.warn('[AINative] Failed to resolve ACP pool warmup config', error);
        },
      )
      .catch((error) => {
        this.logger.warn('[AINative] Failed to warm up ACP agent pool', error);
      });
  }

  private registerWebMcpSurface() {
    if (this.webMcpModelContextDisposable) {
      return;
    }

    // Register WebMCP groups once, then expose the same registry through
    // navigator.modelContext and the Node-side HTTP MCP server.
    const groupRegistry = this.injector.get(WebMcpGroupRegistryToken);
    groupRegistry.registerGroup(createOpenSumiMcpGroup(this.injector));
    groupRegistry.registerGroup(createWorkspaceGroup(this.injector));
    groupRegistry.registerGroup(createSearchGroup(this.injector));
    groupRegistry.registerGroup(createDiagnosticsGroup(this.injector));
    groupRegistry.registerGroup(createFileGroup(this.injector));
    groupRegistry.registerGroup(createTerminalGroup(this.injector));
    groupRegistry.registerGroup(createEditorGroup(this.injector));
    groupRegistry.registerGroup(createAcpChatGroup(this.injector));
    this.webMcpModelContextDisposable = registerWebMcpModelContextTools(groupRegistry);
  }

  private async initMCPServers() {
    const storage = await this.storageProvider(STORAGE_NAMESPACE.CHAT);
    let disabledMCPServers = storage.get<string[]>(MCPServersDisabledKey, []);

    const oldMCPServers = this.preferenceService.get<MCPServerDescription[]>(AINativeSettingSectionsId.MCPServers, []);
    let mcpServerFromWorkspace = this.preferenceService.resolve<{ mcpServers: Record<string, any> }>(
      'mcp',
      {
        mcpServers: {},
      },
      undefined,
    );
    if (mcpServerFromWorkspace.scope === PreferenceScope.Default && oldMCPServers.length > 0) {
      // 如果用户没有配置，也没有存储，则从旧配置迁移
      const newMCPServers = {
        mcpServers: {},
      };
      const mcpServersDisabled = new Set<string>();
      oldMCPServers.forEach((server) => {
        if (server.type === MCP_SERVER_TYPE.SSE) {
          newMCPServers.mcpServers[server.name] = {
            url: (server as any).serverHost,
          };
        } else if (server.type === MCP_SERVER_TYPE.STDIO) {
          newMCPServers.mcpServers[server.name] = {
            command: server.command,
            args: server.args,
            env: server.env,
          };
        }
        // 如果旧配置中服务器被禁用，添加到禁用列表
        if (!server.enabled) {
          mcpServersDisabled.add(server.name);
        }
      });
      // 如果内置服务器在旧配置中没有启用，则禁用它
      if (!oldMCPServers.find((s) => s.name === BUILTIN_MCP_SERVER_NAME)?.enabled) {
        mcpServersDisabled.add(BUILTIN_MCP_SERVER_NAME);
      }
      await this.preferenceService.set('mcp', newMCPServers, PreferenceScope.Workspace);
      mcpServerFromWorkspace = this.preferenceService.resolve<{ mcpServers: Record<string, any> }>(
        'mcp',
        {
          mcpServers: {},
        },
        undefined,
      );
      disabledMCPServers = Array.from(mcpServersDisabled);
      storage.set(MCPServersDisabledKey, disabledMCPServers);
    }
    const userServers = mcpServerFromWorkspace.value?.mcpServers;
    // 总是初始化内置服务器，根据禁用列表决定是否启用
    const webMcpEnabled = this.preferenceService.get<boolean>(AINativeSettingSectionsId.WebMcpEnabled, true);
    this.sumiMCPServerBackendProxy.$initBuiltinMCPServer(
      !disabledMCPServers.includes(BUILTIN_MCP_SERVER_NAME) && webMcpEnabled !== false,
    );

    if (userServers && Object.keys(userServers).length > 0) {
      const mcpServers = (
        await Promise.all(
          Object.keys(userServers).map(async (name) => await this.mcpConfigService.getServerConfigByName(name)),
        )
      ).filter((server) => server !== undefined) as MCPServerDescription[];
      await this.sumiMCPServerBackendProxy.$initExternalMCPServers(mcpServers);
    }
    this.mcpConfigService.fireMCPServersChange(true);
  }

  private getModelByName(modelName: string) {
    switch (modelName) {
      case 'deepseek':
        return deepSeekModels;
      case 'anthropic':
        return anthropicModels;
      case 'openai':
        return openAiNativeModels;
      default:
        return undefined;
    }
  }

  private registerFeature() {
    this.contributions.getContributions().forEach((contribution) => {
      contribution.registerInlineChatFeature?.(this.inlineChatFeatureRegistry);
      contribution.registerChatFeature?.(this.chatFeatureRegistry);
      contribution.registerResolveConflictFeature?.(this.resolveConflictRegistry);
      contribution.registerRenameProvider?.(this.renameCandidatesProviderRegistry);
      contribution.registerChatRender?.(this.chatRenderRegistry);
      contribution.registerTerminalProvider?.(this.terminalProviderRegistry);
      contribution.registerIntelligentCompletionFeature?.(this.intelligentCompletionsRegistry);
      contribution.registerProblemFixFeature?.(this.problemFixProviderRegistry);
      contribution.registerChatAgentPromptProvider?.();
    });

    // 注册默认输入组件
    this.registerDefaultInputs();

    // 注册默认聊天视图和历史记录组件
    this.registerChatViews();

    // 注册内置的 "Chat" 按钮，将选中代码添加到 Chat 面板的 context 中
    if (this.aiNativeConfigService.capabilities.supportsChatAssistant) {
      this.inlineChatFeatureRegistry.registerEditorInlineChat(
        {
          id: 'ai-chat',
          name: 'Chat',
          title: 'Add to Chat',
          renderType: 'button',
        },
        {
          execute: async (editor, selection) => {
            const model = editor.getModel();
            if (!model) {
              return;
            }
            const uri = model.uri;
            const [startLine, endLine] = [selection.selectionStartLineNumber, selection.positionLineNumber].sort(
              (a, b) => a - b,
            );

            this.llmContextService.addFileToContext(new URI(uri.toString()), [startLine, endLine], true);
            this.chatService.sendMessage({ message: '', immediate: false });
          },
        },
      );
    }

    // 注册 Opensumi 框架提供的 MCP Server Tools 能力 (此时的 Opensumi 作为 MCP Server)
    this.mcpServerContributions.getContributions().forEach((contribution) => {
      contribution.registerMCPServer(this.mcpServerRegistry);
    });
  }

  private registerDefaultInputs() {
    this.chatInputRegistry.registerChatInput({
      id: 'acp-mention-input',
      component: AcpChatMentionInput,
      capabilities: ['restore-draft', 'focus', 'expand', 'images', 'mentions', 'paste', 'rich-queued-edit'],
      queuedTurnEditor: AcpQueuedTurnEditor,
      priority: 200,
      when: () => this.aiNativeConfigService.capabilities.supportsAgentMode,
    });

    this.chatInputRegistry.registerChatInput({
      id: 'acp-chat-input',
      component: AcpChatInput,
      capabilities: ['restore-draft', 'focus', 'expand'],
      priority: 150,
      when: () => this.aiNativeConfigService.capabilities.supportsAgentMode,
    });

    this.chatInputRegistry.registerChatInput({
      id: 'mention-input',
      component: ChatMentionInput,
      priority: 100,
      when: () => this.aiNativeConfigService.capabilities.supportsMCP,
    });

    this.chatInputRegistry.registerChatInput({
      id: 'chat-input',
      component: ChatInput,
      priority: 50,
    });
  }

  private registerChatViews() {
    this.chatViewRegistry.registerChatView({
      id: 'acp-chat-view',
      component: AIChatViewACP,
      priority: 200,
      when: () => this.aiNativeConfigService.capabilities.supportsAgentMode,
    });

    this.chatViewRegistry.registerChatView({
      id: 'default-chat-view',
      component: AIChatView,
      priority: 50,
    });
  }

  registerSetting(registry: ISettingRegistry) {
    registry.registerSettingGroup({
      id: AI_NATIVE_SETTING_GROUP_ID,
      title: AI_NATIVE_SETTING_GROUP_TITLE,
      iconClass: getIcon('magic-wand'),
    });

    registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
      title: localize('preference.ai.native.chat.title'),
      preferences: [
        {
          id: AINativeSettingSectionsId.ChatVisibleType,
          localized: 'preference.ai.native.chat.visible.type',
        },
        {
          id: AINativeSettingSectionsId.PanelLayout,
          localized: 'preference.ai.native.panelLayout',
        },
      ],
    });

    registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
      title: localize('preference.ai.native.interface.quick.title'),
      preferences: [
        {
          id: AINativeSettingSectionsId.InterfaceQuickNavigationEnabled,
          localized: 'preference.ai.native.interface.quick.navigation',
        },
      ],
    });

    if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.intelligentCompletions.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.IntelligentCompletionsCacheEnabled,
            localized: 'preference.ai.native.intelligentCompletions.cache.enabled',
          },
          {
            id: AINativeSettingSectionsId.IntelligentCompletionsDebounceTime,
            localized: 'preference.ai.native.intelligentCompletions.debounceTime',
          },
          {
            id: AINativeSettingSectionsId.IntelligentCompletionsPromptEngineeringEnabled,
            localized: 'preference.ai.native.intelligentCompletions.promptEngineering.enabled',
          },
          {
            id: AINativeSettingSectionsId.IntelligentCompletionsAlwaysVisible,
            localized: 'preference.ai.native.intelligentCompletions.alwaysVisible',
          },
        ],
      });
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.codeEdits.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.CodeEditsLintErrors,
            localized: 'preference.ai.native.codeEdits.lintErrors',
          },
          {
            id: AINativeSettingSectionsId.CodeEditsLineChange,
            localized: 'preference.ai.native.codeEdits.lineChange',
          },
          {
            id: AINativeSettingSectionsId.CodeEditsTyping,
            localized: 'preference.ai.native.codeEdits.typing',
          },
          {
            id: AINativeSettingSectionsId.CodeEditsRenderType,
            localized: 'preference.ai.native.codeEdits.renderType',
          },
          {
            id: AINativeSettingSectionsId.SystemPrompt,
            localized: 'preference.ai.native.chat.system.prompt',
          },
        ],
      });
    }

    // Register language model API key settings
    if (this.aiNativeConfigService.capabilities.supportsCustomLLMSettings) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.llm.apiSettings.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.LLMModelSelection,
            localized: 'preference.ai.native.llm.model.selection',
          },
          {
            id: AINativeSettingSectionsId.ModelID,
            localized: 'preference.ai.native.llm.model.id',
          },
          {
            id: AINativeSettingSectionsId.DeepseekApiKey,
            localized: 'preference.ai.native.deepseek.apiKey',
          },
          {
            id: AINativeSettingSectionsId.AnthropicApiKey,
            localized: 'preference.ai.native.anthropic.apiKey',
          },
          {
            id: AINativeSettingSectionsId.OpenaiApiKey,
            localized: 'preference.ai.native.openai.apiKey',
          },
          {
            id: AINativeSettingSectionsId.OpenaiBaseURL,
            localized: 'preference.ai.native.openai.baseURL',
          },
          {
            id: AINativeSettingSectionsId.MaxTokens,
            localized: 'preference.ai.native.maxTokens',
          },
          {
            id: AINativeSettingSectionsId.ContextWindow,
            localized: 'preference.ai.native.contextWindow',
          },
        ],
      });
    }

    // Register MCP server settings
    if (this.aiNativeConfigService.capabilities.supportsMCP) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.mcp.settings.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.MCPServers,
            localized: 'preference.ai.native.mcp.servers',
          },
          {
            id: AINativeSettingSectionsId.TerminalAutoRun,
            localized: 'ai.native.terminal.autorun',
          },
        ],
      });
    }

    // Register Agent configs settings
    if (this.aiNativeConfigService.capabilities.supportsAgentMode) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.agent.configs.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.AgentConfigs,
            localized: 'preference.ai.native.agent.configs',
          },
          {
            id: AINativeSettingSectionsId.DefaultAgentType,
            localized: 'preference.ai.native.agent.defaultType',
          },
          {
            id: AINativeSettingSectionsId.AcpThreadPoolSize,
            localized: 'preference.ai-native.acp.threadPoolSize',
          },
          {
            id: AINativeSettingSectionsId.AcpDeliveryMode,
            localized: 'preference.ai-native.acp.deliveryMode',
          },
        ],
      });
    }

    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.inlineChat.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.InlineChatAutoVisible,
            localized: 'preference.ai.native.inlineChat.auto.visible',
          },
          {
            id: AINativeSettingSectionsId.InlineChatCodeActionEnabled,
            localized: 'preference.ai.native.inlineChat.codeAction.enabled',
          },
          {
            id: AINativeSettingSectionsId.InlineDiffPreviewMode,
            localized: 'preference.ai.native.inlineDiff.preview.mode',
          },
        ],
      });
    }
  }

  registerEditorFeature(registry: IEditorFeatureRegistry): void {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => this.codeActionSingleHandler.mountEditor(editor.monacoEditor),
    });
  }

  registerEditorComponent(registry: EditorComponentRegistry): void {
    registry.registerEditorSideWidget({
      id: INLINE_DIFF_MANAGER_WIDGET_ID,
      component: InlineDiffManager,
      displaysOnResource: (resource) => {
        if (
          this.aiNativeConfigService.capabilities.supportsMCP &&
          this.applyService.getUriCodeBlocks(resource.uri)?.filter((block) => block.status === 'pending').length
        ) {
          return true;
        }
        return false;
      },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    registerAgenticWorkbenchRevealCommandInterceptors(commands, this.panelLayoutService, this.mainLayoutService);

    commands.registerCommand(AI_CHAT_INPUT_TOGGLE_EXPANDED, {
      execute: () => this.chatInputRegistry.getActiveInputHandle()?.toggleExpanded?.(),
    });

    commands.registerCommand(
      { ...AI_CHAT_NEW_CHAT, enablement: `${AI_PANEL_LAYOUT_CONTEXT} == classic` },
      {
        execute: () => {
          const draft = this.chatInputRegistry.preserveActiveDraft() || this.aiChatService.getInputDraft();
          this.aiChatService.updateInputDraft(draft);
          this.panelLayoutService.showAIChatView('classic');
          this.aiChatService.enterDraftSession();
          this.chatInputRegistry.restoreActiveDraft(draft);
          this.focusChatInputAfterReveal();
        },
      },
    );

    commands.registerCommand(
      { ...AI_CHAT_NEW_TASK, enablement: `${AI_PANEL_LAYOUT_CONTEXT} == agentic` },
      {
        execute: async (agentId?: string) => {
          const draft = this.chatInputRegistry.preserveActiveDraft() || this.aiChatService.getInputDraft();
          this.aiChatService.updateInputDraft(draft);
          this.panelLayoutService.showAIChatView('agentic');
          const result = await this.agenticWorkspaceSwitchService.launchHeaderTask(agentId);
          if (result.status === 'launched') {
            this.chatInputRegistry.restoreActiveDraft(draft);
            this.focusChatInputAfterReveal();
            return;
          }
          if (result.status === 'no-agent') {
            const configureLabel = localize('aiNative.chat.agentSelector.configureAgents', 'Agent Configurations');
            const selected = await this.messageService.warning(
              localize('aiNative.chat.newTask.noAgent', 'No ACP Agent available'),
              [configureLabel],
              true,
            );
            if (selected === configureLabel) {
              await this.preferenceService.set(
                AINativeSettingSectionsId.AgentConfigs,
                getAvailableAgentConfigs(this.preferenceService),
                PreferenceScope.User,
              );
              await this.commandService.executeCommand(
                COMMON_COMMANDS.OPEN_PREFERENCES.id,
                AINativeSettingSectionsId.AgentConfigs,
              );
            }
            return;
          }
          if (result.status === 'project-unavailable' || result.status === 'no-project') {
            await this.messageService.warning(
              localize('aiNative.chat.newTask.workspaceUnavailable', 'Workspace Target unavailable'),
            );
            return;
          }
          if (result.status === 'failed') {
            await this.messageService.warning(localize('aiNative.chat.newTask.failed', 'Failed to create a new Task'));
          }
        },
      },
    );

    commands.registerCommand(AI_INLINE_CHAT_VISIBLE, {
      execute: (value: boolean) => {
        this.aiInlineChatService._onInlineChatVisible.fire(value);
      },
    });

    commands.registerCommand(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE, {
      execute: async (isVisible: boolean) => {
        if (!isVisible) {
          this.inlineInputService.hide();
          return;
        }

        // 每次在展示 inline input 的时候，先隐藏 inline chat
        this.commandService.executeCommand(AI_INLINE_CHAT_VISIBLE.id, false);

        const editor = this.workbenchEditorService.currentCodeEditor;
        if (!editor) {
          return;
        }

        const position = editor.monacoEditor.getPosition();
        if (!position) {
          return;
        }

        const selection = editor.monacoEditor.getSelection();
        const isEmptyLine = position ? editor.monacoEditor.getModel()?.getLineLength(position.lineNumber) === 0 : false;

        if (isEmptyLine) {
          this.inlineInputService.visibleByPosition(position);
          return;
        }

        if (selection && !selection.isEmpty()) {
          this.inlineInputService.visibleBySelection(selection);
          return;
        }

        this.inlineInputService.visibleByNearestCodeBlock(position, editor.monacoEditor);
      },
    });

    commands.registerCommand(AI_INLINE_CHAT_INTERACTIVE_INPUT_CANCEL, {
      execute: () => {
        const editor = this.workbenchEditorService.currentCodeEditor;
        if (editor) {
          InlineInputController.get(editor.monacoEditor)?.cancelToken();
        }
      },
    });

    commands.registerCommand(AI_INLINE_COMPLETION_REPORTER, {
      execute: (relationId: string, sessionId: string, accept: boolean, code: string) => {
        this.aiCompletionsService.report({ sessionId, accept, relationId, code });
      },
    });

    commands.registerCommand(AI_CHAT_VISIBLE, {
      execute: (visible?: boolean) => {
        if (visible === false) {
          this.panelLayoutService.hideAIChatView();
          return;
        }
        this.panelLayoutService.showAIChatView();
      },
    });

    commands.registerCommand(AI_PANEL_LAYOUT_SET, {
      execute: (mode: PanelLayoutMode) => this.panelLayoutService.setLayoutMode(mode),
    });

    commands.registerCommand(AI_PANEL_LAYOUT_GET, {
      execute: () => this.panelLayoutService.getLayoutMode(),
    });

    commands.registerCommand(AI_PANEL_LAYOUT_TOGGLE, {
      execute: () => this.panelLayoutService.toggleLayoutMode(),
    });

    commands.registerCommand(AI_AGENTIC_WORKBENCH_TOGGLE, {
      execute: (visible?: boolean) => this.panelLayoutService.toggleAgenticWorkbenchVisibility(visible),
    });

    commands.registerCommand(AI_AGENTIC_WORKBENCH_IS_VISIBLE, {
      execute: () => this.panelLayoutService.isAgenticWorkbenchVisible(),
    });

    commands.registerCommand(AI_INLINE_COMPLETION_VISIBLE, {
      execute: async (visible: boolean) => {
        if (!visible) {
          this.aiCompletionsService.hideStatusBarItem();
          this.aiInlineCompletionsProvider.setVisibleCompletion(false);
          this.aiInlineCompletionsProvider.cancelRequest();
        }
      },
    });

    commands.registerCommand(AI_INLINE_DIFF_PARTIAL_EDIT, {
      execute: (isAccept: boolean) => {
        this.inlineStreamDiffService.launchAcceptDiscardPartialEdit(isAccept);
      },
    });

    /**
     * 当 inline completion 消失时
     */
    commands.afterExecuteCommand(HideInlineCompletion.ID, () => {
      this.commandService.executeCommand(AI_INLINE_COMPLETION_VISIBLE.id, false);
    });
  }

  private focusChatInputAfterReveal(): void {
    this.chatInputRegistry.focusActiveInput();
    runWhenIdle(() => this.chatInputRegistry.focusActiveInput());
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      submenu: AI_PANEL_LAYOUT_MENU,
      label: 'Panel Layout',
      group: '5_panel',
    });
    menus.registerMenuItem(AI_PANEL_LAYOUT_MENU, {
      command: {
        id: AI_PANEL_LAYOUT_SET.id,
        label: 'Classic',
      },
      group: 'navigation',
      extraTailArgs: ['classic'],
      toggledWhen: `${AI_PANEL_LAYOUT_CONTEXT} == classic`,
    });
    menus.registerMenuItem(AI_PANEL_LAYOUT_MENU, {
      command: {
        id: AI_PANEL_LAYOUT_SET.id,
        label: 'Agent',
      },
      group: 'navigation',
      extraTailArgs: ['agentic'],
      toggledWhen: `${AI_PANEL_LAYOUT_CONTEXT} == agentic`,
    });
  }

  registerRenderer(registry: SlotRendererRegistry): void {
    const tabbarConfig: TabbarBehaviorConfig = {
      isLatter: true,
    };
    if (this.designLayoutConfig.supportExternalChatPanel) {
      registry.registerSlotRenderer(AI_CHAT_VIEW_ID, AIChatTabRendererWithTab, tabbarConfig);
    } else {
      registry.registerSlotRenderer(AI_CHAT_VIEW_ID, AIChatTabRenderer, tabbarConfig);
    }

    if (this.designLayoutConfig.useMergeRightWithLeftPanel) {
      registry.registerSlotRenderer(
        SlotLocation.view,
        AILeftTabRenderer,
        Object.assign({}, tabbarConfig, {
          isLatter: false,
        }),
      );
      registry.registerSlotRenderer(SlotLocation.extendView, AIRightTabRenderer, tabbarConfig);
    }
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AI_CHAT_CONTAINER_ID, [], {
      component: DynamicChatViewWrapper,
      title: localize('aiNative.chat.ai.assistant.name'),
      iconClass: getIcon('magic-wand'),
      containerId: AI_CHAT_CONTAINER_ID,
    });
    registry.register(AI_MENU_BAR_DEBUG_TOOLBAR, {
      id: AI_MENU_BAR_DEBUG_TOOLBAR,
      component: AIRunToolbar,
    });
    registry.register(AI_CHAT_LOGO_AVATAR_ID, {
      id: AI_CHAT_LOGO_AVATAR_ID,
      component: AIChatLogoAvatar,
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    if (this.aiNativeConfigService.capabilities.supportsAgentMode) {
      keybindings.registerKeybinding(
        {
          command: AI_CHAT_NEW_CHAT.id,
          keybinding: 'ctrlcmd+alt+n',
          when: `${AI_PANEL_LAYOUT_CONTEXT} == classic`,
        },
        KeybindingScope.USER,
      );
      keybindings.registerKeybinding(
        {
          command: AI_CHAT_NEW_TASK.id,
          keybinding: 'ctrlcmd+alt+n',
          when: `${AI_PANEL_LAYOUT_CONTEXT} == agentic`,
        },
        KeybindingScope.USER,
      );
    }

    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      // 通过 CMD + i 唤起 Inline Chat （浮动组件）
      keybindings.registerKeybinding(
        {
          command: AI_INLINE_CHAT_VISIBLE.id,
          keybinding: 'ctrlcmd+i',
          when: 'editorTextFocus',
          args: true,
          priority: 0,
        },
        KeybindingScope.USER,
      );
      // 当 Inline Chat （浮动组件）展示时，通过 ESC 退出
      keybindings.registerKeybinding({
        command: AI_INLINE_CHAT_VISIBLE.id,
        keybinding: 'esc',
        args: false,
        when: `editorFocus && ${InlineChatIsVisible.raw}`,
      });

      if (this.inlineInputService.getInteractiveInputHandler()) {
        // 当 Inline Chat （浮动组件）展示时，通过 CMD K 唤起 Inline Input
        keybindings.registerKeybinding(
          {
            command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
            keybinding: this.aiNativeConfigService.inlineChat.inputKeybinding,
            args: true,
            priority: 0,
            when: `editorFocus && (${InlineChatIsVisible.raw} || inlineSuggestionVisible)`,
          },
          KeybindingScope.USER,
        );
        // 当 Inline Input 展示时，通过 ESC 退出
        keybindings.registerKeybinding({
          command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
          keybinding: 'esc',
          args: false,
          priority: 0,
          when: `editorFocus && ${InlineInputWidgetIsVisible.raw}`,
        });
        // 当 Inline Input 流式编辑时，通过 ESC 退出
        keybindings.registerKeybinding({
          command: AI_INLINE_CHAT_INTERACTIVE_INPUT_CANCEL.id,
          keybinding: 'esc',
          priority: 1,
          when: `editorFocus && ${InlineInputWidgetIsStreaming.raw}`,
        });
        // 当出现 CMD K 展示信息时，通过快捷键快速唤起 Inline Input
        keybindings.registerKeybinding(
          {
            command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
            keybinding: this.aiNativeConfigService.inlineChat.inputKeybinding,
            args: true,
            priority: 0,
            when: `editorFocus && ${InlineHintWidgetIsVisible.raw} && ${InlineChatIsVisible.not}`,
          },
          KeybindingScope.USER,
        );
      }
    }

    keybindings.registerKeybinding({
      command: AI_INLINE_DIFF_PARTIAL_EDIT.id,
      keybinding: 'ctrl+y',
      args: true,
      priority: 100,
      when: `editorTextFocus && ${InlineDiffPartialEditsIsVisible.raw}`,
    });
    keybindings.registerKeybinding({
      command: AI_INLINE_DIFF_PARTIAL_EDIT.id,
      keybinding: 'ctrl+n',
      args: false,
      priority: 100,
      when: `editorTextFocus && ${InlineDiffPartialEditsIsVisible.raw}`,
    });
  }
}
