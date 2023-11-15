import { MaybePromise, CancellationToken } from '@opensumi/ide-core-common';

export const AiBackSerivceToken = Symbol('AiBackSerivceToken');
export const AiBackSerivcePath = 'AiBackSerivcePath';

export interface IAiBackServiceOption {
  type?: string;
  model?: string;
  cancelToken?: CancellationToken;
}

export interface IAiCompletionOption {
  prompt: string;
  suffix?: string;
  language?: string;
  fileUrl?: string;
}

export interface IAiBackServiceResponse<T = string> {
  errorCode?: number;
  errorMsg?: string;
  isCancel?: boolean;
  data?: T;
}

export interface IAiBackService {
  request<T extends IAiBackServiceResponse, O extends IAiBackServiceOption>(input: string, options?: O): Promise<T>;
  requestStream<T extends NodeJS.ReadableStream, O extends IAiBackServiceOption>(
    input: string,
    options?: O,
  ): Promise<T>;
  requestCompletion<I extends IAiCompletionOption, T = string[]>(input: I): Promise<T>;
}

export const AiInlineChatContentWidget = 'Ai-inline-chat-content-widget';

export const Ai_CHAT_CONTAINER_VIEW_ID = 'ai_chat';

export interface IChatMessageStructure {
  /**
   * 用于 chat 面板展示
   */
  message: string | React.ReactNode;
  /**
   * 实际调用的 prompt
   */
  prompt?: string;
}

/**
 * 指令 key
 */
export enum InstructionEnum {
  aiSearchKey = '/search ',
  aiSumiKey = '/ide ',
  aiExplainKey = '/explain ',
  aiRunKey = '/run ',
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
  Search,
  Sumi,
  GPT,
  Explain,
  Run,
}

export type AiRunHandler = () => MaybePromise<void>;
export interface IAiRunAnswerComponentProps {
  input: string;
}

export const IAiRunFeatureRegistry = Symbol('IAiRunFeatureRegistry');

export interface IAiRunFeatureRegistry {
  /**
   * 注册 run 运行的能力
   */
  registerRun(handler: AiRunHandler): void;
  /**
   * 返回 answer 时渲染的组件
   */
  registerAnswerComponent(component: React.FC<IAiRunAnswerComponentProps>): void;

  getRuns(): AiRunHandler[];
}

export const AiNativeContribution = Symbol('AiNativeContribution');
export interface AiNativeContribution {
  /**
   * 注册 ai run 的能力
   * @param registry
   */
  registerRunFeature?(registry: IAiRunFeatureRegistry): void;
}

export enum AiNativeSettingSectionsId {
  INLINE_CHAT_AUTO_VISIBLE = 'inlineChat.auto.visible',
}

export const AI_NATIVE_SETTING_GROUP_ID = 'AI-Native';

export const IAiChatService = Symbol('IAiChatService');

export interface PromptOption {
  language?: string;
  useCot?: boolean;
}
