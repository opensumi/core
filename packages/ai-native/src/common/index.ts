export const AiGPTBackSerivceToken = Symbol('AiGPTBackSerivceToken');
export const AiGPTBackSerivcePath = 'AiGPTBackSerivcePath';

export const Ai_CHAT_CONTAINER_VIEW_ID = 'ai_chat';

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
  SearchCode,
  Sumi,
  GPT,
  Explain,
  Run,
}
