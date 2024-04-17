import {
  AISerivceType,
  CancellationToken,
  Event,
  FileType,
  IDisposable,
  IMarkdownString,
  Uri,
} from '@opensumi/ide-core-common';

export const IAINativeService = Symbol('IAINativeService');

export const AIInlineChatContentWidget = 'AI_Inline_Chat_Content_Widget';
export const AI_CHAT_VIEW_ID = 'AI_Chat';
export const AI_CHAT_CONTAINER_ID = 'AI_Chat_Container';
export const AI_MENU_BAR_DEBUG_TOOLBAR = 'AI_MENU_BAR_DEBUG_TOOLBAR';
export const AI_MENUBAR_CONTAINER_VIEW_ID = 'AI_menubar';

export const AI_SLASH = '/';

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
  reportType?: AISerivceType;
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

export const IChatInternalService = Symbol('IChatInternalService');
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
  updateAgent(id: string, updateMetadata: IChatAgentMetadata): Promise<void>;
  populateChatInput(id: string, message: IChatMessageStructure): void;
  getCommands(): Array<IChatAgentCommand & { agentId: string }>;
  parseMessage(value: string, currentAgentId?: string): { agentId: string; command: string; message: string };
  getFollowups(id: string, sessionId: string, token: CancellationToken): Promise<IChatFollowup[]>;
  getSampleQuestions(id: string, token: CancellationToken): Promise<IChatFollowup[]>;
  getAllSampleQuestions(): Promise<IChatReplyFollowup[]>;
  getDefaultAgentId(): undefined | string;
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
  provideChatWelcomeMessage(token: CancellationToken): Promise<undefined | IChatAgentWelcomeMessage>;
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

export interface IChatAgentWelcomeMessage {
  content: IChatWelcomeMessageContent;
  sampleQuestions?: IChatReplyFollowup[];
}
