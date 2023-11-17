import { AISerivceType } from '../index';

export const AI_REPORTER_NAME = 'AI';

export interface CommonLogInfo {
  replytime: number;
  success: boolean;
  msgType: AISerivceType;
  message: string;
  isStart: boolean;
  isLike: boolean;
}

export interface QuestionInfo extends Partial<CommonLogInfo> {
  isRetry: boolean;
  isStop: boolean;
}

export interface CodeInfo extends Partial<CommonLogInfo> {
  isReceive: boolean;
  isDrop: boolean;
}

export interface GenerateInfo extends Partial<CommonLogInfo> {
  fileCount: number;
  requirment: string;
}

export interface CommandInfo extends Partial<CommonLogInfo> {
  useCommand: boolean;
  useCommandSuccess: boolean;
}

export interface RunInfo extends Partial<CommonLogInfo> {
  runSuccess: boolean;
}

export type ReportInfo = Partial<CommonLogInfo>
  | ({ type: AISerivceType.GPT } & QuestionInfo)
  | ({ type: AISerivceType.Explain } & QuestionInfo)
  | ({ type: AISerivceType.Search } & QuestionInfo)
  | ({ type: AISerivceType.Test } & QuestionInfo)
  | ({ type: AISerivceType.Optimize } & CodeInfo)
  | ({ type: AISerivceType.Generate } & GenerateInfo)
  | ({ type: AISerivceType.Sumi } & CommandInfo)
  | ({ type: AISerivceType.Run } & RunInfo);

export const IAIReporter = Symbol('IAIReporter');

export interface IAIReporter {
  getCommonReportInfo(): Record<string, unknown>;
  // 返回关联 ID
  start(msg: string, data: ReportInfo): string;
  end(relationId: string, data: ReportInfo);
}
