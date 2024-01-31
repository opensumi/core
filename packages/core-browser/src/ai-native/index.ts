export * from './ai-config.service';
export * from './reporter';

export const IAiInlineChatService = Symbol('IAiInlineChatService');
export interface IAiInlineChatService {
  fireThumbsEvent(isThumbsUp: boolean): void;
}
