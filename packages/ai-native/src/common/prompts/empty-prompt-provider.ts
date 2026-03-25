import { Injectable } from '@opensumi/di';

import { DefaultChatAgentPromptProvider } from './context-prompt-provider';

/**
 * 用于 acp agent，复用 DefaultChatAgentPromptProvider 的 context 拼接逻辑
 */
@Injectable()
export class ACPChatAgentPromptProvider extends DefaultChatAgentPromptProvider {}
