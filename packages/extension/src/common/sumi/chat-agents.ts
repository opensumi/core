import type vscode from 'vscode';

import type {
  IChatAgentMetadata,
  IChatAgentRequest,
  IChatMessage,
  IChatProgress,
  IChatAgentResult,
  IChatAgentCommand,
  IChatAsyncContent,
  IChatFollowup,
  IChatReplyFollowup,
} from '@opensumi/ide-ai-native/lib/common';
import { CancellationToken } from '@opensumi/ide-core-common';

export interface IExtensionChatAgentMetadata extends IChatAgentMetadata {
  hasSlashCommands?: boolean;
  hasFollowups?: boolean;
  hasSampleQuestions?: boolean;
}

export type IChatProgressChunk = Exclude<IChatProgress, IChatAsyncContent> | Omit<IChatAsyncContent, 'resolvedContent'>;

export interface IChatInputParam {
  command?: string;
  prompt: string;
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
}
