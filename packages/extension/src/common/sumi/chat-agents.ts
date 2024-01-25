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

export interface ChatAgentContent {
  content: string;
}

interface ChatAgentTask {
  placeholder: string;
  resolvedContent: Thenable<ChatAgentContent | vscode.ChatAgentFileTree>;
}

// progress 暂时只支持这些类型，后续需支持更多的类型
export type ChatAgentProgress =
  | ChatAgentContent
  | ChatAgentTask
  | vscode.ChatAgentMarkdownContent
  | vscode.ChatAgentFileTree;

export interface ChatAgentRequest extends vscode.ChatAgentRequest {
  regenerate?: boolean;
}

export type ChatAgentHandler = (
  request: ChatAgentRequest,
  context: vscode.ChatAgentContext,
  progress: vscode.Progress<ChatAgentProgress>,
  token: vscode.CancellationToken,
) => vscode.ProviderResult<vscode.ChatAgentResult2>;

export interface ChatAgentSampleQuestionProvider {
  provideSampleQuestions(token: CancellationToken): vscode.ProviderResult<vscode.ChatAgentReplyFollowup[]>;
}

export interface ChatInputParam {
  command?: string;
  prompt: string;
}

export interface ChatAgent extends vscode.ChatAgent2 {
  sampleQuestionProvider?: ChatAgentSampleQuestionProvider;
  populateChatInput?: (param: ChatInputParam) => void;
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
  $populateChatInput: (handle: number, param: ChatInputParam) => void;
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
