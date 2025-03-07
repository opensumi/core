export enum AINativeSettingSectionsId {
  /**
   * inline diff preview mode
   */
  InlineDiffPreviewMode = 'ai.native.inlineDiff.preview.mode',

  InlineChatAutoVisible = 'ai.native.inlineChat.auto.visible',
  InlineChatCodeActionEnabled = 'ai.native.inlineChat.codeAction.enabled',
  InterfaceQuickNavigationEnabled = 'ai.native.interface.quickNavigation.enabled',
  ChatVisibleType = 'ai.native.chat.visible.type',

  /**
   * Whether to enable prompt engineering, some LLM models may not perform well on prompt engineering.
   */
  IntelligentCompletionsPromptEngineeringEnabled = 'ai.native.intelligentCompletions.promptEngineering.enabled',
  IntelligentCompletionsDebounceTime = 'ai.native.intelligentCompletions.debounceTime',
  IntelligentCompletionsCacheEnabled = 'ai.native.intelligentCompletions.cache.enabled',
  IntelligentCompletionsAlwaysVisible = 'ai.native.intelligentCompletions.alwaysVisible',

  /**
   * Code edits settings
   */
  CodeEditsLintErrors = 'ai.native.codeEdits.lintErrors',
  CodeEditsLineChange = 'ai.native.codeEdits.lineChange',
  CodeEditsTyping = 'ai.native.codeEdits.typing',
  CodeEditsRenderType = 'ai.native.codeEdits.renderType',

  /**
   * Language model API keys
   */
  LLMModelSelection = 'ai.native.llm.model.selection',
  ModelID = 'ai.native.llm.model.id',
  DeepseekApiKey = 'ai.native.deepseek.apiKey',
  AnthropicApiKey = 'ai.native.anthropic.apiKey',
  OpenaiApiKey = 'ai.native.openai.apiKey',
  OpenaiBaseURL = 'ai.native.openai.baseURL',

  /**
   * MCP Server configurations
   */
  MCPServers = 'ai.native.mcp.servers',

  /**
   * System prompt
   */
  SystemPrompt = 'ai.native.chat.system.prompt',
}
export const AI_NATIVE_SETTING_GROUP_ID = 'AI-Native';
export const AI_NATIVE_SETTING_GROUP_TITLE = 'AI Native';
