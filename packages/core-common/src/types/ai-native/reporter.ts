import { ECodeEditsSourceTyping } from './index';

export const AI_REPORTER_NAME = 'AI';

export enum AIServiceType {
  Chat = 'chat',
  InlineChat = 'inlineChat',
  CodeAction = 'codeAction',
  InlineChatInput = 'inlineChatInput',
  CustomReply = 'customReply',
  ToolCall = 'toolCall',
  Completion = 'completion',
  Agent = 'agent',
  MergeConflict = 'mergeConflict',
  Rename = 'rename',
  TerminalAICommand = 'terminalAICommand',
  ProblemFix = 'problemFix',
  CodeEdits = 'codeEdits',
}

export enum ActionSourceEnum {
  // 聊天面板
  Chat = 'chat',
  // 编辑器内联 Chat
  InlineChat = 'inlineChat',
  // 编辑器内联 ChatInput
  InlineChatInput = 'inlineChatInput',
  // 编辑器内 Action
  CodeAction = 'codeAction',
  // 终端
  Terminal = 'terminal',
  // 下拉补全 | 自动补全
  Completion = 'completion',
  // 编辑器内悬停操作
  Hover = 'hover',
}

export enum ActionTypeEnum {
  // 自动补全
  Completion = 'completion',
  // 下拉补全
  DropdownCompletion = 'dropdownCompletion',
  // ai重命名
  Rename = 'rename',
  // Chat面板 插入代码
  ChatInsertCode = 'chatInsertCode',
  // Chat面板 复制代码
  ChatCopyCode = 'chatCopyCode',
  // Chat面板 欢迎语的Action
  Welcome = 'welcome',
  // Chat面板 回复消息的Action
  Followup = 'followup',
  // 发送消息
  Send = 'send',
  // 生成代码后的行动点：全部采纳
  Accept = 'accept',
  // 生成代码后的行动点：单模块采纳
  lineAccept = 'lineAccept',
  // 生成代码后的行动点：全部拒绝
  Discard = 'discard',
  // 生成代码后的行动点：全部拒绝
  LineDiscard = 'lineDiscard',
  // 生成代码后的行动点：重新生成
  Regenerate = 'regenerate',
  // 悬停的问题修复
  HoverFix = 'hoverFix',
  // 上下文增强
  ContextEnhance = 'contextEnhance',
  // 包含业务自定义的Action
}

export interface CommonLogInfo {
  msgType: AIServiceType | string;
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
  language?: string;
  // 针对新版数据增加额外参数
  // 采纳代码
  code?: string;
  // 原始代码
  originCode?: string;
  // 文件路径
  fileUrl?: string;
  // 仓库地址
  repo?: string;
  // 行动点来源
  actionSource?: ActionSourceEnum | string;
  // 行动点类型，内置通用，但是很多来自业务
  actionType?: ActionTypeEnum | string;
  // 是否采纳(采纳必须使用这个字段)
  isReceive?: boolean;
  // 是否弃用(弃用必须使用这个字段)
  isDrop?: boolean;
}

export interface CompletionRT extends Partial<CommonLogInfo> {
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
  code?: string;
}

export enum MergeConflictEditorMode {
  '3way' = '3way',
  'traditional' = 'traditional',
}

export interface ChatRT extends Partial<CommonLogInfo> {
  agentId?: string;
  command?: string;
  userMessage?: string;
  assistantMessage?: string;
  sessionId: string;
  messageId?: string;
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

export interface CodeEditsRT extends Partial<CommonLogInfo> {
  actionSource?: ECodeEditsSourceTyping;
}

export type ReportInfo =
  | Partial<CommonLogInfo>
  | ({ type: AIServiceType.Completion } & CompletionRT)
  | ({ type: AIServiceType.MergeConflict } & MergeConflictRT)
  | ({ type: AIServiceType.Rename } & RenameRT)
  | ({ type: AIServiceType.InlineChat } & InlineChatRT)
  | ({ type: AIServiceType.InlineChatInput } & InlineChatRT)
  | ({ type: AIServiceType.Chat } & ChatRT)
  | ({ type: AIServiceType.Agent } & ChatRT)
  | ({ type: AIServiceType.CodeEdits } & CodeEditsRT);

export const IAIReporter = Symbol('IAIReporter');

export interface IAIReporter {
  getCommonReportInfo(): Record<string, unknown>;
  getCacheReportInfo<T = ReportInfo>(relationId: string): T | undefined;
  record(data: ReportInfo, relationId?: string): ReportInfo;
  getRelationId(): string;
  // 返回关联 ID
  start(msg: string, data: ReportInfo, timeout?: number): string;
  end(relationId: string, data: ReportInfo): void;
  send(data: ReportInfo): void;
}
