import { AISerivceType } from '../index';

export const AI_REPORTER_NAME = 'AI';

export interface CommonLogInfo {
  replytime: number;
  success: boolean;
  msgType: AISerivceType;
  message: string;
  isStart: boolean;
  isLike: boolean;
  // 是否有效
  isValid: boolean;
  model: string;
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

export interface Completion extends Partial<CommonLogInfo> {
  isReceive?: boolean;
  // 是否取消
  isStop?: boolean;
  // 补全条数
  completionNum?: number;
  // 渲染时长
  renderingTime?: number;
}

export type ReportInfo =
  | Partial<CommonLogInfo>
  | ({ type: AISerivceType.GPT } & QuestionInfo)
  | ({ type: AISerivceType.Explain } & QuestionInfo)
  | ({ type: AISerivceType.SearchCode } & QuestionInfo)
  | ({ type: AISerivceType.SearchDoc } & QuestionInfo)
  | ({ type: AISerivceType.Test } & QuestionInfo)
  | ({ type: AISerivceType.Optimize } & CodeInfo)
  | ({ type: AISerivceType.Generate } & GenerateInfo)
  | ({ type: AISerivceType.Sumi } & CommandInfo)
  | ({ type: AISerivceType.Run } & RunInfo)
  | ({ type: AISerivceType.Completion } & Completion);

export const IAIReporter = Symbol('IAIReporter');

export interface IAIReporter {
  getCommonReportInfo(): Record<string, unknown>;
  // 返回关联 ID
  start(msg: string, data: ReportInfo): string;
  end(relationId: string, data: ReportInfo);
}
