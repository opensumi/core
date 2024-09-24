import { CancellationToken } from '@opensumi/ide-core-common';

import type {
  IChatAgentCommand,
  IChatAgentMetadata,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentWelcomeMessage,
  IChatFollowup,
  IChatReplyFollowup,
} from '@opensumi/ide-ai-native/lib/common';
import type { IChatAsyncContent, IChatProgress } from '@opensumi/ide-core-common';
import type { IChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

export interface IExtensionChatAgentMetadata extends IChatAgentMetadata {
  hasSlashCommands?: boolean;
  hasFollowups?: boolean;
  hasSampleQuestions?: boolean;
  hasChatWelcomMessage?: boolean;
  isDefault?: boolean;
}

export type IChatProgressChunk = Exclude<IChatProgress, IChatAsyncContent> | Omit<IChatAsyncContent, 'resolvedContent'>;

export interface IChatInputParam {
  command?: string;
  prompt: string;
}

/**
 * proposed api
 */
export interface IInlineChatPreviewProviderMetadata {
  enableCodeblockRender?: boolean;
}

export interface IMainThreadChatAgents {
  $registerAgent(handle: number, name: string, metadata: IExtensionChatAgentMetadata): void;
  $updateAgent(handle: number, metadataUpdate: IExtensionChatAgentMetadata): void;
  $unregisterAgent(handle: number): void;
  $handleProgressChunk(
    requestId: string,
    chunk: IChatProgressChunk,
    responsePartHandle?: number,
  ): Promise<number | void>;
  $populateChatInput: (handle: number, param: IChatInputParam) => void;
  $sendMessage: (chunk: IChatProgress) => void;

  /**
   * proposed api，会随时更改
   */
  $registerInlineChatProvider(handle: number, name: string, metadata: IInlineChatPreviewProviderMetadata): void;
}

export interface IExtHostChatAgents {
  $invokeAgent(
    handle: number,
    request: IChatAgentRequest,
    context: { history: IChatMessage[] },
    token: CancellationToken,
  ): Promise<IChatAgentResult | undefined>;
  $provideSlashCommands(handle: number, token: CancellationToken): Promise<IChatAgentCommand[]>;
  $provideFollowups(handle: number, sessionId: string, token: CancellationToken): Promise<IChatFollowup[]>;
  $provideSampleQuestions(handle: number, token: CancellationToken): Promise<IChatReplyFollowup[]>;
  $provideChatWelcomeMessage(handle: number, token: CancellationToken): Promise<undefined | IChatAgentWelcomeMessage>;
}
