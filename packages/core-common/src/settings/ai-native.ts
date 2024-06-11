export enum AINativeSettingSectionsId {
  InlineChatAutoVisible = 'ai.native.inlineChat.auto.visible',
  InlineChatCodeActionEnabled = 'ai.native.inlineChat.codeAction.enabled',
  InterfaceQuickNavigationEnabled = 'ai.native.interface.quickNavigation.enabled',
  ChatVisibleType = 'ai.native.chat.visible.type',

  /**
   * Whether to enable prompt engineering, some LLM models may not perform well on prompt engineering.
   */
  InlineCompletionsPromptEngineeringEnabled = 'ai.native.inlineCompletions.promptEngineering.enabled',
  InlineCompletionsDebounceTime = 'ai.native.inlineCompletions.debounceTime',
}
export const AI_NATIVE_SETTING_GROUP_ID = 'AI-Native';
export const AI_NATIVE_SETTING_GROUP_TITLE = 'AI Native';
