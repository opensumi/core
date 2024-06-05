export enum AINativeSettingSectionsId {
  INLINE_CHAT_AUTO_VISIBLE = 'ai.native.inlineChat.auto.visible',
  INLINE_CHAT_CODE_ACTION_ENABLED = 'ai.native.inlineChat.codeAction.enabled',
  INTERFACE_QUICK_NAVIGATION_ENABLED = 'ai.native.interface.quickNavigation.enabled',
  CHAT_VISIBLE_TYPE = 'ai.native.chat.visible.type',

  /**
   * Whether to enable prompt engineering, some LLM models may not perform well on prompt engineering.
   */
  INLINE_COMPLETIONS_PROMPT_ENGINEERING_ENABLED = 'ai.native.inlineCompletions.prompt.engineering.enabled',
}
export const AI_NATIVE_SETTING_GROUP_ID = 'AI-Native';
export const AI_NATIVE_SETTING_GROUP_TITLE = 'AI Native';
