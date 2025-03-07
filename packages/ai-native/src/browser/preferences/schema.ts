import { AINativeSettingSectionsId, PreferenceSchema } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-common';

import { CodeEditsRenderType } from '../contrib/intelligent-completions';

export enum EInlineDiffPreviewMode {
  inlineLive = 'inlineLive',
  sideBySide = 'sideBySide',
}

export const aiNativePreferenceSchema: PreferenceSchema = {
  properties: {
    [AINativeSettingSectionsId.InlineDiffPreviewMode]: {
      type: 'string',
      enum: [EInlineDiffPreviewMode.inlineLive, EInlineDiffPreviewMode.sideBySide],
      enumDescriptions: [
        localize('preference.ai.native.inlineDiff.preview.mode.inlineLive'),
        localize('preference.ai.native.inlineDiff.preview.mode.sideBySide'),
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
      description: localize('preference.ai.native.codeEdits.renderType'),
    },
    [AINativeSettingSectionsId.LLMModelSelection]: {
      type: 'string',
      default: 'deepseek',
      enum: ['deepseek', 'anthropic', 'openai', 'openai-compatible'],
      description: localize('preference.ai.native.llm.model.selection.description'),
    },
    [AINativeSettingSectionsId.ModelID]: {
      type: 'string',
      default: 'deepseek-chat',
      description: localize('preference.ai.native.llm.model.id'),
    },
    [AINativeSettingSectionsId.DeepseekApiKey]: {
      type: 'string',
      default: '',
      description: localize('preference.ai.native.deepseek.apiKey.description'),
    },
    [AINativeSettingSectionsId.AnthropicApiKey]: {
      type: 'string',
      default: '',
      description: localize('preference.ai.native.anthropic.apiKey.description'),
    },
    [AINativeSettingSectionsId.OpenaiApiKey]: {
      type: 'string',
      default: '',
      description: localize('preference.ai.native.openai.apiKey.description'),
    },
    [AINativeSettingSectionsId.OpenaiBaseURL]: {
      type: 'string',
      default: '',
      description: localize('preference.ai.native.openai.baseURL.description'),
    },
    [AINativeSettingSectionsId.MCPServers]: {
      type: 'array',
      default: [],
      description: localize('preference.ai.native.mcp.servers.description'),
      items: {
        type: 'object',
        required: ['name', 'command', 'args'],
        properties: {
          name: {
            type: 'string',
            description: localize('preference.ai.native.mcp.servers.name.description'),
          },
          command: {
            type: 'string',
            description: localize('preference.ai.native.mcp.servers.command.description'),
          },
          type: {
            type: 'string',
            enum: ['stdio', 'sse'],
            enumDescriptions: [
              localize('preference.ai.native.mcp.servers.type.stdio'),
              localize('preference.ai.native.mcp.servers.type.sse'),
            ],
            description: localize('preference.ai.native.mcp.servers.type.description'),
            default: 'stdio',
          },
          enabled: {
            type: 'boolean',
            description: localize('preference.ai.native.mcp.servers.enabled.description'),
            default: true,
          },
          args: {
            type: 'array',
            items: {
              type: 'string',
            },
            default: [],
            description: localize('preference.ai.native.mcp.servers.args.description'),
          },
          env: {
            type: 'object',
            additionalProperties: {
              type: 'string',
            },
            description: localize('preference.ai.native.mcp.servers.env.description'),
            default: {},
          },
        },
      },
    },
    [AINativeSettingSectionsId.CodeEditsTyping]: {
      type: 'boolean',
      default: false,
    },
    [AINativeSettingSectionsId.SystemPrompt]: {
      type: 'string',
      description: localize('preference.ai.native.chat.system.prompt.description'),
    },
  },
};
