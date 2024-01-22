import { TERMINAL_COMMANDS } from '../common/common.command';

export const AI_EXPLAIN_TERMINAL_COMMANDS = {
  id: 'ai.explain.terminal',
  label: 'AI 助手: 对此进行解释',
  category: TERMINAL_COMMANDS.CATEGORY,
};

export const AI_EXPLAIN_DEBUG_COMMANDS = {
  id: 'ai.explain.debug',
  label: 'AI 助手: 对此进行解释',
  category: 'debug',
};

export const AI_RUN_DEBUG_COMMANDS = {
  id: 'ai.run.debug',
};

export const AI_CHAT_PANEL_TOGGLE_VISIBLE = {
  id: 'ai.chat.panel.toggle.visible',
};

export const AI_INLINE_CHAT_VISIBLE = {
  id: 'ai.inline.chat.visible',
};

export const AI_INLINE_COMPLETION_VISIBLE = {
  id: 'ai.inline.completion.visible',
};

export const AI_INLINE_COMPLETION_REPORTET = {
  id: 'ai.inline.completion.reporter',
};

/**
 * 调用 AI 智能解决冲突
 */
export const AI_RESOLVE_CONFLICT_COMMANDS = {
  id: 'ai.conflict.resolve',
};
