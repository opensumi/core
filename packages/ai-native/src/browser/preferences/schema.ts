import { AINativeSettingSectionsId, DEFAULT_ACP_THREAD_POOL_SIZE, PreferenceSchema } from '@opensumi/ide-core-browser';

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

export enum EWebMcpProfile {
  minimal = 'minimal',
  default = 'default',
  interactive = 'interactive',
  full = 'full',
}

export enum EAIPanelLayout {
  classic = 'classic',
  agentic = 'agentic',
}

export enum EAcpDeliveryMode {
  minimal = 'minimal',
  stream = 'stream',
}

export const WEBMCP_PROFILE_SETTING_ID = 'ai.native.webmcp.profile';

const DEFAULT_AGENT_CONFIGS_PREFERENCE = {
  qwen: {
    command: 'qwen',
    args: ['--acp', '--channel=ACP', '--input-format=stream-json', '--output-format=stream-json'],
    streaming: true,
    description: 'Qwen CLI Agent',
  },
  'claude-agent-acp': {
    command: 'claude-agent-acp',
    args: [],
    streaming: true,
    description: 'Claude Code ACP Agent',
  },
};

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
    [AINativeSettingSectionsId.PanelLayout]: {
      type: 'string',
      enum: [EAIPanelLayout.classic, EAIPanelLayout.agentic],
      default: EAIPanelLayout.classic,
      description: 'Controls the AI Native panel layout.',
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
    [AINativeSettingSectionsId.AgentConfigs]: {
      type: 'object',
      default: DEFAULT_AGENT_CONFIGS_PREFERENCE,
      defaultSnippets: [
        {
          label: 'acp default agent configs',
          description: '%preference.ai.native.agent.configs.snippet.description%',
          bodyText:
            '{\n\t"qwen": {\n\t\t"command": "qwen",\n\t\t"args": ["--acp", "--channel=ACP", "--input-format=stream-json", "--output-format=stream-json"],\n\t\t"streaming": true,\n\t\t"description": "Qwen CLI Agent"\n\t},\n\t"claude-agent-acp": {\n\t\t"command": "claude-agent-acp",\n\t\t"args": [],\n\t\t"streaming": true,\n\t\t"description": "Claude Code ACP Agent"\n\t}\n}',
        },
      ],
      examples: [DEFAULT_AGENT_CONFIGS_PREFERENCE],
      description: '%preference.ai.native.agent.configs.description%',
      markdownDescription: '%preference.ai.native.agent.configs.markdownDescription%',
      errorMessage: '%preference.ai.native.agent.configs.errorMessage%',
      additionalProperties: {
        type: 'object',
        required: ['command'],
        additionalProperties: false,
        errorMessage: '%preference.ai.native.agent.configs.item.errorMessage%',
        properties: {
          command: {
            type: 'string',
            minLength: 1,
            description: '%preference.ai.native.agent.configs.command.description%',
          },
          args: {
            type: 'array',
            items: {
              type: 'string',
            },
            default: [],
            description: '%preference.ai.native.agent.configs.args.description%',
          },
          streaming: {
            type: 'boolean',
            default: true,
            description: '%preference.ai.native.agent.configs.streaming.description%',
          },
          description: {
            type: 'string',
            description: '%preference.ai.native.agent.configs.description.description%',
          },
        },
      },
    },
    [AINativeSettingSectionsId.DefaultAgentType]: {
      type: 'string',
      default: 'claude-agent-acp',
      description: '%preference.ai.native.agent.defaultType.description%',
    },
    [AINativeSettingSectionsId.TerminalAutoRun]: {
      type: 'string',
      enum: [ETerminalAutoExecutionPolicy.off, ETerminalAutoExecutionPolicy.auto, ETerminalAutoExecutionPolicy.always],
      default: ETerminalAutoExecutionPolicy.auto,
      markdownDescription: '%ai.native.terminal.autorun.description%',
    },
    [AINativeSettingSectionsId.WebMcpEnabled]: {
      type: 'boolean',
      default: true,
      description: 'Controls whether OpenSumi built-in WebMCP IDE capabilities are exposed to ACP agents.',
    },
    [WEBMCP_PROFILE_SETTING_ID]: {
      type: 'string',
      enum: [EWebMcpProfile.minimal, EWebMcpProfile.default, EWebMcpProfile.interactive, EWebMcpProfile.full],
      default: EWebMcpProfile.default,
      description: 'Controls which OpenSumi WebMCP tools are exposed to ACP agents.',
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
    [AINativeSettingSectionsId.NodePath]: {
      type: 'string',
      default: '',
      description: '%preference.ai-native.acp.nodePath.description%',
    },
    [AINativeSettingSectionsId.AcpThreadPoolSize]: {
      type: 'number',
      default: DEFAULT_ACP_THREAD_POOL_SIZE,
      minimum: 1,
      description: '%preference.ai-native.acp.threadPoolSize.description%',
    },
    [AINativeSettingSectionsId.AcpDeliveryMode]: {
      type: 'string',
      enum: [EAcpDeliveryMode.minimal, EAcpDeliveryMode.stream],
      enumDescriptions: [
        '%preference.ai-native.acp.deliveryMode.minimal%',
        '%preference.ai-native.acp.deliveryMode.stream%',
      ],
      default: EAcpDeliveryMode.stream,
      description: '%preference.ai-native.acp.deliveryMode.description%',
    },
    [AINativeSettingSectionsId.AgentConfigsOverride]: {
      type: 'object',
      description: '%preference.ai-native.acp.agents.description%',
      markdownDescription: '%preference.ai-native.acp.agents.markdownDescription%',
      additionalProperties: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '%preference.ai-native.acp.agentConfigsOverride.command.description%',
          },
          args: {
            type: 'array',
            items: {
              type: 'string',
            },
            default: [],
            description: '%preference.ai-native.acp.agentConfigsOverride.args.description%',
          },
          env: {
            type: 'object',
            additionalProperties: {
              type: 'string',
            },
            description: '%preference.ai-native.acp.agentConfigsOverride.env.description%',
            default: {},
          },
          defaultModel: {
            type: 'string',
            description: 'Default ACP model id to apply when creating or loading a session.',
          },
          defaultMode: {
            type: 'string',
            description: 'Default ACP mode id to apply when creating or loading a session.',
          },
          defaultConfigOptions: {
            type: 'object',
            additionalProperties: {
              anyOf: [{ type: 'string' }, { type: 'boolean' }],
            },
            description: 'Default ACP session config option values keyed by config option id.',
            default: {},
          },
        },
      },
    },
  },
};
