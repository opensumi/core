import type {
  IChatAgentMetadata,
  IChatAgentRequest,
  IChatMessage,
  IChatProgress,
  IChatAgentResult,
  IChatAgentCommand,
} from '@opensumi/ide-ai-native/lib/common';
import { CancellationToken } from '@opensumi/ide-core-common';

export interface IExtensionChatAgentMetadata extends IChatAgentMetadata {
  hasSlashCommands?: boolean;
  hasFollowups?: boolean;
}

export interface IMainThreadChatAgents {
  $registerAgent(handle: number, name: string, metadata: IExtensionChatAgentMetadata): void;
  $updateAgent(handle: number, metadataUpdate: IExtensionChatAgentMetadata): void;
  $unregisterAgent(handle: number): void;
  $handleProgressChunk(requestId: string, chunk: IChatProgress, responsePartHandle?: number): Promise<number | void>;
}

export interface IExtHostChatAgents {
  $invokeAgent(
    handle: number,
    sessionId: string,
    requestId: string,
    request: IChatAgentRequest,
    context: { history: IChatMessage[] },
    token: CancellationToken,
  ): Promise<IChatAgentResult | undefined>;
  $provideSlashCommands(handle: number, token: CancellationToken): Promise<IChatAgentCommand[]>;
}
