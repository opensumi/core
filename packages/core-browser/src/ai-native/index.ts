export * from './ai-config.service';

export const IAiInlineChatService = Symbol('IAiInlineChatService');
export interface IAiInlineChatService {
  fireThumbsEvent(isThumbsUp: boolean): void;
}

export const IAiInlineCompletionService = Symbol('IAiInlineChatService');
export interface IAiInlineCompletionService {
  getCompletionResult(): any;
}
