export * from './ai-config.service';

export const IAIInlineChatService = Symbol('IAIInlineChatService');
export interface IAIInlineChatService {
  fireThumbsEvent(isThumbsUp: boolean): void;
}
