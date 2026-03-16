import { Injectable } from '@opensumi/di';

import { SerializedContext } from '../llm-context';

import { ChatAgentPromptProvider } from './context-prompt-provider';

/**
 * 用于acp agent 不做任何处理
 */
@Injectable()
export class ACPChatAgentPromptProvider implements ChatAgentPromptProvider {
  async provideContextPrompt(context: SerializedContext, userMessage: string) {
    return userMessage;
  }
}
