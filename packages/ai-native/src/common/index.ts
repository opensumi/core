import { CancellationToken, Event, FileType, IDisposable, IMarkdownString, Uri } from '@opensumi/ide-core-common';

export const IAINativeService = Symbol('IAINativeService');

export const AIInlineChatContentWidget = 'AI_Inline_Chat_Content_Widget';
export const AI_CHAT_CONTAINER_VIEW_ID = 'AI_Chat';

export interface IChatMessageStructure {
  /**
   * 用于 chat 面板展示
   */
  message: string;
  /**
   * 实际调用的 prompt
   */
  prompt?: string;
  /**
   * 数据采集上报消息类型
   */
  reportType?: string;
  /*
   * agent id
   */
  agentId?: string;
  /**
   * slash command
   */
  command?: string;
  /**
   * 是否立即发送，默认为 true
   */
  immediate?: boolean;
}

/**
 * 指令 key
 */
export enum InstructionEnum {
  aiExplainKey = '/ Explain ',
  aiOptimzeKey = '/ Optimize ',
  aiCommentsKey = '/ Comments ',
  aiTestKey = '/ Test ',
  aiSumiKey = '/ IDE ',
  aiRunKey = '/ RUN ',
}

export enum ChatCompletionRequestMessageRoleEnum {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
}

export interface ChatCompletionRequestMessage {
  /**
   * The role of the author of this message.
   * @type {string}
   * @memberof ChatCompletionRequestMessage
   */
  role: ChatCompletionRequestMessageRoleEnum;
  /**
   * The contents of the message
   * @type {string}
   * @memberof ChatCompletionRequestMessage
   */
  content: string;
  /**
   * The name of the user in a multi-user chat
   * @type {string}
   * @memberof ChatCompletionRequestMessage
   */
  name?: string;
}

export enum AISerivceType {
  Sumi = 'sumi',
  GPT = 'chat',
  Explain = 'explain',
  Run = 'run',
  Test = 'test',
  Optimize = 'optimize',
  Generate = 'generate',
  Completion = 'completion',
  Agent = 'agent',
}

export const IAIChatService = Symbol('IAIChatService');
export const IChatManagerService = Symbol('IChatManagerService');
export const IChatAgentService = Symbol('IChatAgentService');

export interface IChatAgentService {
  readonly onDidChangeAgents: Event<void>;
  readonly onDidSendMessage: Event<IChatContent>;
  registerAgent(agent: IChatAgent): IDisposable;
  invokeAgent(
    id: string,
    request: IChatAgentRequest,
    progress: (part: IChatProgress) => void,
    history: IChatMessage[],
    token: CancellationToken,
  ): Promise<IChatAgentResult>;
  getAgents(): Array<IChatAgent>;
  getAgent(id: string): IChatAgent | undefined;
  hasAgent(id: string): boolean;
  updateAgent(id: string, updateMetadata: IChatAgentMetadata): void;
  populateChatInput(id: string, message: IChatMessageStructure): void;
  getCommands(): Array<IChatAgentCommand & { agentId: string }>;
  parseMessage(value: string, currentAgentId?: string): { agentId: string; command: string; message: string };
  getFollowups(id: string, sessionId: string, token: CancellationToken): Promise<IChatFollowup[]>;
  getSampleQuestions(id: string, token: CancellationToken): Promise<IChatFollowup[]>;
  getAllSampleQuestions(): Promise<IChatReplyFollowup[]>;
  sendMessage(chunk: IChatContent): void;
}

export interface IChatAgent extends IChatAgentData {
  invoke(
    request: IChatAgentRequest,
    progress: (part: IChatProgress) => void,
    history: IChatMessage[],
    token: CancellationToken,
  ): Promise<IChatAgentResult>;
  provideFollowups?(sessionId: string, token: CancellationToken): Promise<IChatFollowup[]>;
  provideSlashCommands(token: CancellationToken): Promise<IChatAgentCommand[]>;
  provideSampleQuestions?(token: CancellationToken): Promise<IChatReplyFollowup[]>;
}

export interface IChatAgentData {
  id: string;
  metadata: IChatAgentMetadata;
}

export interface IChatAgentMetadata {
  description?: string;
  isDefault?: boolean;
  fullName?: string;
  icon?: Uri;
  iconDark?: Uri;
}

export interface IChatAgentRequest {
  sessionId: string;
  requestId: string;
  command?: string;
  message: string;
  regenerate?: boolean;
}

export const enum ChatMessageRole {
  System,
  User,
  Assistant,
  Function,
}

export interface IChatMessage {
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly name?: string;
}

export interface IChatContent {
  content: string;
  kind: 'content';
}

export interface IChatMarkdownContent {
  content: IMarkdownString;
  kind: 'markdownContent';
}

export interface IChatAsyncContent {
  content: string;
  resolvedContent: Promise<string | IMarkdownString | IChatTreeData>;
  kind: 'asyncContent';
}

export interface IChatProgressMessage {
  content: string;
  kind: 'progressMessage';
}

export interface IChatResponseProgressFileTreeData {
  label: string;
  uri: Uri;
  type?: FileType;
  children?: IChatResponseProgressFileTreeData[];
}

export interface IChatTreeData {
  treeData: IChatResponseProgressFileTreeData;
  kind: 'treeData';
}

export interface IChatComponent {
  component: string;
  value?: unknown;
  kind: 'component';
}

export type IChatProgress = IChatContent | IChatMarkdownContent | IChatAsyncContent | IChatTreeData | IChatComponent;

export interface IChatResponseErrorDetails {
  message: string;
}

export interface IChatAgentResult {
  errorDetails?: IChatResponseErrorDetails;
}

export interface IChatAgentCommand {
  name: string;
  description: string;
}

export interface IChatReplyFollowup {
  kind: 'reply';
  message: string;
  title?: string;
  tooltip?: string;
}

export interface IChatResponseCommandFollowup {
  kind: 'command';
  commandId: string;
  args?: any[];
  title: string;
  when?: string;
}

export type IChatFollowup = IChatReplyFollowup | IChatResponseCommandFollowup;

export interface IChatMessage {
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly name?: string;
}

export interface IChatRequestMessage {
  prompt: string;
  agentId: string;
  command?: string;
}

export interface IChatRequestModel {
  readonly requestId: string;
  session: IChatModel;
  message: IChatRequestMessage;
  response: IChatResponseModel;
}

export interface IChatResponseModel {
  readonly requestId: string;
  session: IChatModel;
}

export interface IChatModel {
  readonly requests: IChatRequestModel[];
}

export type IChatWelcomeMessageContent = string | IMarkdownString;

export interface ISampleQuestions {
  title: string;
  message: string;
  icon?: string;
  tooltip?: string;
}
