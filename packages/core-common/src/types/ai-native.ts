export interface IAiNativeCapabilities {
  /**
   * 使用 opensumi design UI 风格
   */
  supportsOpenSumiDesign?: boolean;
  /**
   * 问题面板使用 ai 能力
   */
  supportsAiMarkers?: boolean;
  /**
   * 使用 ai 助手能力
   */
  supportsAiChatAssistant?: boolean;
  /**
   * 使用 inline chat 能力
   */
  supportsInlineChat?: boolean;
  /**
   * 使用代码智能补全能力
   */
  supportsInlineCompletion?: boolean;
  /**
   * 使用 ai 智能解决冲突的能力
   */
  supportsConflictResolve?: boolean;
  /**
   * 使用 ai 调试控制台问题诊断能力
   */
  supportsDebugConsole?: boolean;
}

export interface AiNativeConfig {
  capabilities?: IAiNativeCapabilities;
}
