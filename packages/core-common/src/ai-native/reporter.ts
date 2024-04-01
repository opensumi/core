export const AI_REPORTER_NAME = 'AI';

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

export interface CommonLogInfo {
  msgType: AISerivceType;
  relationId: string;
  replytime: number;
  success: boolean;
  message: string;
  isStart: boolean;
  isLike: boolean;
  // 是否有效
  isValid: boolean;
  model: string;
  copy: boolean;
  insert: boolean;
  isTimePoint: boolean;
}

export interface QuestionRT extends Partial<CommonLogInfo> {
  isRetry: boolean;
  isStop: boolean;
}

export interface CodeRT extends Partial<CommonLogInfo> {
  isReceive: boolean;
  isDrop: boolean;
}

export interface GenerateRT extends Partial<CommonLogInfo> {
  fileCount: number;
  requirment: string;
}

export interface CommandRT extends Partial<CommonLogInfo> {
  useCommand: boolean;
  useCommandSuccess: boolean;
}

export interface RunRT extends Partial<CommonLogInfo> {
  runSuccess: boolean;
}

export interface CompletionRT extends Partial<CommonLogInfo> {
  isReceive?: boolean;
  // 是否取消
  isStop?: boolean;
  // 补全条数
  completionNum?: number;
  // 渲染时长
  renderingTime?: number;

  userAcceptTimePoint?: number;
}

export interface CompletionTimePoint {
  /**
   * 用于记录 DOM 渲染时长的时间点
   */
  domRenderTimePoint?: number;
  startRequestCompletionTimePoint?: number;
  endRequestCompletionTimePoint?: number;
}

export interface MergeConflictRT extends Partial<CommonLogInfo> {
  // 解决冲突模式 （3-way 或 传统模式）
  editorMode: '3way' | 'traditional';
  // 冲突点数量（仅包含 AI 冲突点）
  conflictPointNum: number;
  // 使用了 ai 处理的冲突点数量
  useAiConflictPointNum: number;
  // 被用户采纳了的冲突点数量
  receiveNum: number;
  // 点击了 ai 解决冲突的数量
  clickNum: number;
  // 点击了一键解决的次数
  clickAllNum: number;
  // ai 成功输出了的数量
  aiOutputNum: number;
  // 取消次数
  cancelNum: number;
}

export type ReportInfo =
  | Partial<CommonLogInfo>
  | ({ type: AISerivceType.GPT } & QuestionRT)
  | ({ type: AISerivceType.Explain } & QuestionRT)
  | ({ type: AISerivceType.SearchCode } & QuestionRT)
  | ({ type: AISerivceType.SearchDoc } & QuestionRT)
  | ({ type: AISerivceType.Test } & QuestionRT)
  | ({ type: AISerivceType.Optimize } & CodeRT)
  | ({ type: AISerivceType.Generate } & GenerateRT)
  | ({ type: AISerivceType.Sumi } & CommandRT)
  | ({ type: AISerivceType.Run } & RunRT)
  | ({ type: AISerivceType.Completion } & CompletionRT)
  | ({ type: AISerivceType.MergeConflict } & MergeConflictRT);

export const IAIReporter = Symbol('IAIReporter');

export interface IAIReporter {
  getCommonReportInfo(): Record<string, unknown>;
  getCacheReportInfo<T = ReportInfo>(relationId: string): T | undefined;
  record(data: ReportInfo, relationId?: string): ReportInfo;
  // 返回关联 ID
  start(msg: string, data: ReportInfo): string;
  end(relationId: string, data: ReportInfo): void;
  tp(relationId: string, data: ITimePoint): void;
}

export type ITimePoint =
  | Partial<CommonLogInfo>
  | ({
      msgType: AISerivceType.Completion;
    } & CompletionTimePoint);
