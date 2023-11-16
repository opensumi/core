export const AI_REPORTER_NAME = 'AI';

export enum AI_REPORTER_MSG {
  CHAT_QUESTION = 'chat_question',
  CHAT_ANSWER = 'chat_answer'
};

export interface CommonLogInfo {
  replytime: number;
  success: boolean;
  scenarioName: string;
  msg: AI_REPORTER_MSG;
  model: string;
  prompt: string;
  answer: string;
  relationId: string;
}

export interface QuestionInfo extends CommonLogInfo {
  isLike: boolean;
  isRetry: boolean;
  isStop: boolean;
}

export interface CodeInfo extends CommonLogInfo {
  isReceive: boolean;
  isDrop: boolean;
}

export interface GenerateInfo extends CommonLogInfo {
  fileCount: number;
  requirment: string;
}

export interface CommandInfo extends CommonLogInfo {
  useCommand: boolean;
  useCommandSuccess: boolean;
}

export interface RunInfo extends CommonLogInfo {
  generateFile: boolean;
  runSuccess: boolean;
}

export type ReportInfo = Partial<QuestionInfo> | Partial<CodeInfo> | Partial<GenerateInfo> | Partial<CommandInfo> | Partial<RunInfo>;

export const IAIReporter = Symbol('IAIReporter');

export interface IAIReporter {
  getCommonReportInfo(): Record<string, unknown>;
  // 返回关联 ID
  start(data: ReportInfo): string;
  end(relationId: string, data: ReportInfo);
}
