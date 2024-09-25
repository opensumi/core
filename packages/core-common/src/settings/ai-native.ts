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
}
export const AI_NATIVE_SETTING_GROUP_ID = 'AI-Native';
export const AI_NATIVE_SETTING_GROUP_TITLE = 'AI Native';
