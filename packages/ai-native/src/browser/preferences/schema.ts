import { AINativeSettingSectionsId, PreferenceSchema } from '@opensumi/ide-core-browser';

import { CodeEditsRenderType } from '../contrib/intelligent-completions';

export enum EInlineDiffPreviewMode {
  inlineLive = 'inlineLive',
  sideBySide = 'sideBySide',
}

export enum ETerminalAutoExecutionPolicy {
  off = 'off',
  auto = 'auto',
  always = 'always',
}

export const aiNativePreferenceSchema: PreferenceSchema = {
  properties: {
    [AINativeSettingSectionsId.InlineDiffPreviewMode]: {
      type: 'string',
      enum: [EInlineDiffPreviewMode.inlineLive, EInlineDiffPreviewMode.sideBySide],
      enumDescriptions: [
        '%preference.ai.native.inlineDiff.preview.mode.inlineLive%',
        '%preference.ai.native.inlineDiff.preview.mode.sideBySide%',
      ],
      default: EInlineDiffPreviewMode.inlineLive,
    },
    [AINativeSettingSectionsId.InlineChatAutoVisible]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.InlineChatCodeActionEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.InterfaceQuickNavigationEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.ChatVisibleType]: {
      type: 'string',
      enum: ['never', 'always', 'default'],
      default: 'default',
    },
    [AINativeSettingSectionsId.IntelligentCompletionsPromptEngineeringEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.IntelligentCompletionsDebounceTime]: {
      type: 'number',
      default: 150,
    },
    [AINativeSettingSectionsId.IntelligentCompletionsCacheEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.IntelligentCompletionsAlwaysVisible]: {
      type: 'boolean',
      default: false,
    },
    [AINativeSettingSectionsId.CodeEditsLintErrors]: {
      type: 'boolean',
      default: false,
    },
    [AINativeSettingSectionsId.CodeEditsLineChange]: {
      type: 'boolean',
      default: false,
    },
    [AINativeSettingSectionsId.CodeEditsRenderType]: {
      type: 'string',
      default: CodeEditsRenderType.Default,
      enum: [CodeEditsRenderType.Legacy, CodeEditsRenderType.Default],
      description: '%preference.ai.native.codeEdits.renderType%',
    },
    [AINativeSettingSectionsId.LLMModelSelection]: {
      type: 'string',
      default: 'deepseek',
      enum: ['deepseek', 'anthropic', 'openai', 'openai-compatible'],
      description: '%preference.ai.native.llm.model.selection.description%',
    },
    [AINativeSettingSectionsId.ModelID]: {
      type: 'string',
      default: 'deepseek-chat',
      description: '%preference.ai.native.llm.model.id%',
    },
    [AINativeSettingSectionsId.DeepseekApiKey]: {
      type: 'string',
      default: '',
      description: '%preference.ai.native.deepseek.apiKey.description%',
    },
    [AINativeSettingSectionsId.AnthropicApiKey]: {
      type: 'string',
      default: '',
      description: '%preference.ai.native.anthropic.apiKey.description%',
    },
    [AINativeSettingSectionsId.OpenaiApiKey]: {
      type: 'string',
      default: '',
      description: '%preference.ai.native.openai.apiKey.description%',
    },
    [AINativeSettingSectionsId.OpenaiBaseURL]: {
      type: 'string',
      default: '',
      description: '%preference.ai.native.openai.baseURL.description%',
    },
    [AINativeSettingSectionsId.ContextWindow]: {
      type: 'number',
      description: '%preference.ai.native.contextWindow.description%',
    },
    [AINativeSettingSectionsId.MaxTokens]: {
      type: 'number',
      description: '%preference.ai.native.maxTokens.description%',
    },
    /**
     * @deprecated This configuration will be removed in the future. Please use `mcp.json` instead.
     */
    [AINativeSettingSectionsId.MCPServers]: {
      type: 'array',
      default: [],
      description: '%preference.ai.native.mcp.servers.description%',
      items: {
        type: 'object',
        required: ['name', 'command', 'args'],
        properties: {
          name: {
            type: 'string',
            description: '%preference.ai.native.mcp.servers.name.description%',
          },
          command: {
            type: 'string',
            description: '%preference.ai.native.mcp.servers.command.description%',
          },
          type: {
            type: 'string',
            enum: ['stdio', 'sse'],
            enumDescriptions: [
              '%preference.ai.native.mcp.servers.type.stdio%',
              '%preference.ai.native.mcp.servers.type.sse%',
            ],
            description: '%preference.ai.native.mcp.servers.type.description%',
            default: 'stdio',
          },
          enabled: {
            type: 'boolean',
            description: '%preference.ai.native.mcp.servers.enabled.description%',
            default: true,
          },
          args: {
            type: 'array',
            items: {
              type: 'string',
            },
            default: [],
            description: '%preference.ai.native.mcp.servers.args.description%',
          },
          env: {
            type: 'object',
            additionalProperties: {
              type: 'string',
            },
            description: '%preference.ai.native.mcp.servers.env.description%',
            default: {},
          },
        },
      },
    },
    [AINativeSettingSectionsId.TerminalAutoRun]: {
      type: 'string',
      enum: [ETerminalAutoExecutionPolicy.off, ETerminalAutoExecutionPolicy.auto, ETerminalAutoExecutionPolicy.always],
      default: ETerminalAutoExecutionPolicy.auto,
      markdownDescription: '%ai.native.terminal.autorun.description%',
    },
    [AINativeSettingSectionsId.CodeEditsTyping]: {
      type: 'boolean',
      default: false,
    },
    [AINativeSettingSectionsId.SystemPrompt]: {
      type: 'string',
      description: '%preference.ai.native.chat.system.prompt.description%',
    },
    [AINativeSettingSectionsId.GlobalRules]: {
      type: 'string',
      default: '',
      description: '%preference.ai.native.globalRules.description%',
    },
  },
};
