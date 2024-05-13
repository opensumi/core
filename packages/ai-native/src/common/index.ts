import {
  AIInlineChatContentWidgetId,
  AISerivceType,
  CancellationToken,
  Event,
  IChatContent,
  IChatProgress,
  IDisposable,
  IMarkdownString,
  Uri,
} from '@opensumi/ide-core-common';
import { IChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';
import { DESIGN_MENUBAR_CONTAINER_VIEW_ID } from '@opensumi/ide-design/lib/common/constants';

export const IAINativeService = Symbol('IAINativeService');

/**
 * @deprecated Use {@link AIInlineChatContentWidgetId} instead
 */
export const AIInlineChatContentWidget = AIInlineChatContentWidgetId;

export const AI_CHAT_VIEW_ID = 'AI-Chat';
export const AI_CHAT_CONTAINER_ID = 'AI-Chat-Container';
export const AI_CHAT_LOGO_AVATAR_ID = 'AI-Chat-Logo-Avatar';
export const AI_MENU_BAR_DEBUG_TOOLBAR = 'AI_MENU_BAR_DEBUG_TOOLBAR';

/**
 * @deprecated Use {@link DESIGN_MENUBAR_CONTAINER_VIEW_ID} instead
 */
export const AI_MENUBAR_CONTAINER_VIEW_ID = DESIGN_MENUBAR_CONTAINER_VIEW_ID;

export const SLASH_SYMBOL = '/';
export const AT_SIGN_SYMBOL = '@';

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

export const ChatProxyServiceToken = Symbol('ChatProxyServiceToken');

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

/**
 * Terminal type
 */
export interface ITerminalCommandSuggestionDesc {
  description: string;
  command: string;
}
