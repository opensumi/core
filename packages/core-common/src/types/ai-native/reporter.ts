export const AI_REPORTER_NAME = 'AI';

export enum AISerivceType {
  Chat = 'chat',
  InlineChat = 'inlineChat',
  InlineChatInput = 'inlineChatInput',
  CustomReplay = 'customReplay',
  Completion = 'completion',
  Agent = 'agent',
  MergeConflict = 'mergeConflict',
  Rename = 'rename',
}

export interface CommonLogInfo {
  msgType: AISerivceType | string;
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
  isRetry: boolean;
  isDrop: boolean;
}

export interface CompletionRT extends Partial<CommonLogInfo> {
  isReceive?: boolean;
  // 是否取消
  isStop?: boolean;
  // 补全条数
  completionNum?: number;
  // 渲染时长
  renderingTime?: number;
}

export interface IAIReportCompletionOption {
  relationId: string;
  sessionId: string;
  accept: boolean;
  repo?: string;
  completionUseTime?: number;
  renderingTime?: number;
}

export enum MergeConflictEditorMode {
  '3way' = '3way',
  'traditional' = 'traditional',
}

export interface MergeConflictRT extends Partial<CommonLogInfo> {
  // 解决冲突模式 （3-way 或 传统模式）
  editorMode: MergeConflictEditorMode;
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

export interface RenameRT extends Partial<CommonLogInfo> {
  /**
   * 用户取消了重命名操作
   */
  isCancel?: boolean;
  /**
   * 开始请求重命名候选项的时间
   */
  modelRequestStartTime: number;
  /**
   * 请求重命名候选项结束的时间
   */
  modelRequestEndTime: number;
}

export interface InlineChatRT extends Partial<CommonLogInfo> {
  /**
   * 用户触发 Inline Chat 的来源
   */
  source: string;

  /**
   * @deprecated Please use `source` instead
   */
  runByCodeAction?: boolean;
}

export type ReportInfo =
  | Partial<CommonLogInfo>
  | ({ type: AISerivceType.Completion } & CompletionRT)
  | ({ type: AISerivceType.MergeConflict } & MergeConflictRT)
  | ({ type: AISerivceType.Rename } & RenameRT)
  | ({ type: AISerivceType.InlineChat } & InlineChatRT)
  | ({ type: AISerivceType.InlineChatInput } & InlineChatRT);

export const IAIReporter = Symbol('IAIReporter');

export interface IAIReporter {
  getCommonReportInfo(): Record<string, unknown>;
  getCacheReportInfo<T = ReportInfo>(relationId: string): T | undefined;
  record(data: ReportInfo, relationId?: string): ReportInfo;
  // 返回关联 ID
  start(msg: string, data: ReportInfo): string;
  end(relationId: string, data: ReportInfo): void;
}
