export * from './ai-config.service';
export * from './reporter';

export enum AISerivceType {
  SearchDoc = 'searchDoc',
  SearchCode = 'searchCode',
  Sumi = 'sumi',
  GPT = 'chat',
  Explain = 'explain',
  Run = 'run',
  Test = 'test',
  Optimize = 'optimize',
  Generate = 'generate',
  Completion = 'completion',
  Agent = 'agent',
  MergeConflict = 'mergeConflict',
}

export const IAiInlineChatService = Symbol('IAiInlineChatService');
export interface IAiInlineChatService {
  fireThumbsEvent(isThumbsUp: boolean): void;
}
