import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  AINativeConfigService,
  AINativeSettingSectionsId,
  AI_NATIVE_SETTING_GROUP_ID,
  AppConfig,
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
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';
import {
  AI_CHAT_VISIBLE,
  AI_INLINE_CHAT_INTERACTIVE_INPUT_CANCEL,
  AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE,
  AI_INLINE_CHAT_VISIBLE,
  AI_INLINE_COMPLETION_REPORTER,
  AI_INLINE_COMPLETION_VISIBLE,
  AI_INLINE_DIFF_PARTIAL_EDIT,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import {
  InlineChatIsVisible,
  InlineDiffPartialEditsIsVisible,
  InlineHintWidgetIsVisible,
  InlineInputWidgetIsStreaming,
  InlineInputWidgetIsVisible,
} from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  AI_NATIVE_SETTING_GROUP_TITLE,
  ChatFeatureRegistryToken,
  ChatRenderRegistryToken,
  CommandService,
  InlineChatFeatureRegistryToken,
  IntelligentCompletionsRegistryToken,
  ProblemFixRegistryToken,
  RenameCandidatesProviderRegistryToken,
  ResolveConflictRegistryToken,
  TerminalRegistryToken,
  isUndefined,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';
import { IEditor, WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  IEditorFeatureRegistry,
} from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
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
import { MCPServerDescription } from '../common/mcp-server-manager';

import { ChatManagerService } from './chat/chat-manager.service';
import { ChatProxyService } from './chat/chat-proxy.service';
import { ChatInternalService } from './chat/chat.internal.service';
import { AIChatView } from './chat/chat.view';
import { CodeActionSingleHandler } from './contrib/code-action/code-action.handler';
import { AIInlineCompletionsProvider } from './contrib/inline-completions/completeProvider';
import { InlineCompletionsController } from './contrib/inline-completions/inline-completions.controller';
import { AICompletionsService } from './contrib/inline-completions/service/ai-completions.service';
import { IntelligentCompletionsController } from './contrib/intelligent-completions/intelligent-completions.controller';
import { ProblemFixController } from './contrib/problem-fix/problem-fix.controller';
import { RenameSingleHandler } from './contrib/rename/rename.handler';
import { AIRunToolbar } from './contrib/run-toolbar/run-toolbar';
import {
  AIChatTabRenderer,
  AIChatTabRendererWithTab,
  AILeftTabRenderer,
  AIRightTabRenderer,
} from './layout/tabbar.view';
import { AIChatLogoAvatar } from './layout/view/avatar/avatar.view';
import { BaseApplyService } from './mcp/base-apply.service';
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

@Domain(
  ClientAppContribution,
  BrowserEditorContribution,
  CommandContribution,
  SettingContribution,
  KeybindingContribution,
  ComponentContribution,
  SlotRendererContribution,
  MonacoContribution,
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
    MonacoContribution
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

  @Autowired(DesignLayoutConfig)
  private readonly designLayoutConfig: DesignLayoutConfig;

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

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

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

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(IChatManagerService)
  private readonly chatManagerService: ChatManagerService;

  @Autowired(IChatInternalService)
  private readonly chatInternalService: ChatInternalService;

  @Autowired(BaseApplyService)
  private readonly applyService: BaseApplyService;

  constructor() {
    this.registerFeature();
  }

  async initialize() {
    const { supportsChatAssistant } = this.aiNativeConfigService.capabilities;

    if (supportsChatAssistant) {
      ComponentRegistryImpl.addLayoutModule(this.appConfig.layoutConfig, AI_CHAT_VIEW_ID, AI_CHAT_CONTAINER_ID);
      ComponentRegistryImpl.addLayoutModule(this.appConfig.layoutConfig, DESIGN_MENU_BAR_RIGHT, AI_CHAT_LOGO_AVATAR_ID);
      this.chatProxyService.registerDefaultAgent();
      this.chatInternalService.init();
      await this.chatManagerService.init();
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
    runWhenIdle(() => {
      const { supportsRenameSuggestions, supportsInlineChat, supportsMCP, supportsCustomLLMSettings } =
        this.aiNativeConfigService.capabilities;
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
      }

      if (supportsMCP) {
        this.initMCPServers();
      }
    });
  }

  private initMCPServers() {
    // 从 preferences 获取并初始化外部 MCP Servers
    const mcpServers = this.preferenceService.getValid<MCPServerDescription[]>(AINativeSettingSectionsId.MCPServers);

    // 查找内置 MCP Server 的配置
    const builtinServer = mcpServers?.find((server) => server.name === BUILTIN_MCP_SERVER_NAME);

    // 总是初始化内置服务器，根据配置决定是否启用
    this.sumiMCPServerBackendProxy.initBuiltinMCPServer(builtinServer?.enabled ?? true);

    // 初始化其他外部 MCP Servers
    if (mcpServers && mcpServers.length > 0) {
      const externalServers = mcpServers.filter((server) => server.name !== BUILTIN_MCP_SERVER_NAME);
      if (externalServers.length > 0) {
        this.sumiMCPServerBackendProxy.initExternalMCPServers(externalServers);
      }
    }
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

    // 注册 Opensumi 框架提供的 MCP Server Tools 能力 (此时的 Opensumi 作为 MCP Server)
    this.mcpServerContributions.getContributions().forEach((contribution) => {
      contribution.registerMCPServer(this.mcpServerRegistry);
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
      contribute: (editor: IEditor) => {
        const { monacoEditor } = editor;

        this.codeActionSingleHandler.mountEditor(editor.monacoEditor);

        return monacoEditor.onDidScrollChange(() => {
          if (this.ctxMenuRenderer.visible) {
            this.ctxMenuRenderer.hide(true);
          }
        });
      },
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
        this.layoutService.toggleSlot(AI_CHAT_VIEW_ID, isUndefined(visible) ? true : visible);
      },
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

  registerRenderer(registry: SlotRendererRegistry): void {
    if (this.designLayoutConfig.supportExternalChatPanel) {
      registry.registerSlotRenderer(AI_CHAT_VIEW_ID, AIChatTabRendererWithTab);
    } else {
      registry.registerSlotRenderer(AI_CHAT_VIEW_ID, AIChatTabRenderer);
    }

    if (this.designLayoutConfig.useMergeRightWithLeftPanel) {
      registry.registerSlotRenderer(SlotLocation.left, AILeftTabRenderer);
      registry.registerSlotRenderer(SlotLocation.right, AIRightTabRenderer);
    }
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AI_CHAT_CONTAINER_ID, [], {
      component: AIChatView,
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
