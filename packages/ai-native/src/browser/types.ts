import React from 'react';
import { ZodSchema } from 'zod';

import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import {
  CancellationToken,
  ChatResponse,
  Deferred,
  IAICompletionOption,
  IAICompletionResultModel,
  IDisposable,
  IPosition,
  IResolveConflictHandler,
  MaybePromise,
  MergeConflictEditorMode,
} from '@opensumi/ide-core-common';
import {
  ICodeEditor,
  IRange,
  ISelection,
  ITextModel,
  InlineEditProvider,
  NewSymbolNamesProvider,
  Position,
} from '@opensumi/ide-monaco';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';
import { IMarker } from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

import { IChatWelcomeMessageContent, ISampleQuestions, ITerminalCommandSuggestionDesc } from '../common';
import { SerializedContext } from '../common/llm-context';

import {
  ICodeEditsContextBean,
  ICodeEditsResult,
  IIntelligentCompletionsResult,
} from './contrib/intelligent-completions';
import { BaseTerminalDetectionLineMatcher } from './contrib/terminal/matcher';
import { InlineChatController } from './widget/inline-chat/inline-chat-controller';

interface IBaseInlineChatHandler<T extends any[]> {
  /**
   * 直接执行 action 的操作，点击后 inline chat 立即消失
   */
  execute?: (...args: T) => MaybePromise<void>;
  /**
   * 在 editor 里预览输出的结果
   */
  providePreviewStrategy?: (...args: T) => MaybePromise<ChatResponse | InlineChatController>;
  /**
   * @deprecated use providePreviewStrategy api
   */
  providerDiffPreviewStrategy?: (...args: T) => MaybePromise<ChatResponse | InlineChatController>;
}

export type IEditorInlineChatHandler = IBaseInlineChatHandler<
  [editor: ICodeEditor, selection: ISelection, token: CancellationToken]
>;
export type IInteractiveInputHandler = IBaseInlineChatHandler<
  [editor: ICodeEditor, selection: ISelection, value: string, token: CancellationToken]
>;

export enum ERunStrategy {
  /**
   * 正常执行，执行后 input 直接消失
   */
  EXECUTE = 'EXECUTE',
  /**
   * 预览输出结果，执行后 input 保留，并在 editor 里直接展示输出结果
   */
  PREVIEW = 'PREVIEW',
}

/**
 * 制定 inline chat interactive input 的执行策略
 */
export interface IInteractiveInputRunStrategy {
  strategy?: ERunStrategy;
  handleStrategy?: (editor: ICodeEditor, value: string) => MaybePromise<ERunStrategy>;
}

export interface ITerminalInlineChatHandler {
  triggerRules?: 'selection' | (BaseTerminalDetectionLineMatcher | typeof BaseTerminalDetectionLineMatcher)[];
  execute: (stdout: string, stdin: string, rule?: BaseTerminalDetectionLineMatcher) => MaybePromise<void>;
}

export interface IInlineChatFeatureRegistry {
  /**
   * 注册 editor 内联聊天能力
   */
  registerEditorInlineChat(operational: AIActionItem, handler: IEditorInlineChatHandler): IDisposable;
  /**
   * 注销 editor 内联聊天能力
   */
  unregisterEditorInlineChat(operational: AIActionItem): void;
  /**
   * 注册 terminal 内联功能
   */
  registerTerminalInlineChat(operational: AIActionItem, handler: ITerminalInlineChatHandler): IDisposable;
  /**
   * 注册 terminal 内联功能
   */
  unregisterTerminalInlineChat(operational: AIActionItem): void;
  /**
   * 注册 interactive input 功能
   */
  registerInteractiveInput(
    strategyOptions: IInteractiveInputRunStrategy,
    handler: IInteractiveInputHandler,
  ): IDisposable;
}

export interface IChatSlashCommandItem {
  name: string;
  icon?: string;
  description?: string;
  // Whether it is a shortcut command (for display on input)
  isShortcut?: boolean;
  tooltip?: string;
}

export type TChatSlashCommandSend = (value: string) => void;

export type TSlashCommandCustomRender = (props: { userMessage: string }) => React.ReactNode;

export interface IChatSlashCommandHandler {
  execute: (value: string, send: TChatSlashCommandSend, editor?: ICodeEditor) => MaybePromise<void>;
  providerInputPlaceholder?: (value: string, editor?: ICodeEditor) => string;
  providerPrompt?: (value: string, editor?: ICodeEditor) => MaybePromise<string>;
  providerRender?: TSlashCommandCustomRender;
}

export interface IChatFeatureRegistry {
  registerWelcome(content: IChatWelcomeMessageContent | React.ReactNode, sampleQuestions?: ISampleQuestions[]): void;
  registerSlashCommand(command: IChatSlashCommandItem, handler: IChatSlashCommandHandler): void;
}

export type ChatWelcomeRender = (props: {
  message: IChatWelcomeMessageContent;
  sampleQuestions: ISampleQuestions[];
}) => React.ReactElement | React.JSX.Element;
export type ChatAIRoleRender = (props: { content: string }) => React.ReactElement | React.JSX.Element;
export type ChatUserRoleRender = (props: {
  content: string;
  agentId?: string;
  command?: string;
}) => React.ReactElement | React.JSX.Element;
export type ChatThinkingRender = (props: { thinkingText?: string }) => React.ReactElement | React.JSX.Element;
export type ChatThinkingResultRender = (props: { thinkingResult?: string }) => React.ReactElement | React.JSX.Element;
export type ChatInputRender = (props: {
  onSend: (value: string, agentId?: string, command?: string) => void;
  onValueChange?: (value: string) => void;
  onExpand?: (value: boolean) => void;
  placeholder?: string;
  enableOptions?: boolean;
  disabled?: boolean;
  sendBtnClassName?: string;
  defaultHeight?: number;
  value?: string;
  autoFocus?: boolean;
  theme?: string | null;
  setTheme: (theme: string | null) => void;
  agentId: string;
  setAgentId: (theme: string) => void;
  defaultAgentId?: string;
  command: string;
  setCommand: (theme: string) => void;
}) => React.ReactElement | React.JSX.Element;
export type ChatViewHeaderRender = (props: {
  handleClear: () => any;
  handleCloseChatView: () => any;
}) => React.ReactElement | React.JSX.Element;

export interface IChatRenderRegistry {
  registerWelcomeRender(render: ChatWelcomeRender): void;
  /**
   * AI 对象的对话渲染
   */
  registerAIRoleRender(render: ChatAIRoleRender): void;
  /**
   * 用户对象的对话渲染
   */
  registerUserRoleRender(render: ChatUserRoleRender): void;
  registerThinkingRender(render: ChatThinkingRender): void;
  registerThinkingResultRender(render: ChatThinkingResultRender): void;
  /**
   * 输入框渲染
   */
  registerInputRender(render: ChatInputRender): void;

  /**
   * 顶部栏渲染
   */
  registerChatViewHeaderRender(render: ChatViewHeaderRender): void;
}

export interface IResolveConflictRegistry {
  registerResolveConflictProvider(
    editorMode: keyof typeof MergeConflictEditorMode,
    handler: IResolveConflictHandler,
  ): void;
}

export type NewSymbolNamesProviderFn = NewSymbolNamesProvider['provideNewSymbolNames'];

export interface IRenameCandidatesProviderRegistry {
  registerRenameSuggestionsProvider(provider: NewSymbolNamesProviderFn): void;
  getRenameSuggestionsProviders(): NewSymbolNamesProviderFn[];
}

export class TerminalSuggestionReadableStream extends SumiReadableStream<ITerminalCommandSuggestionDesc> {
  static create() {
    return new TerminalSuggestionReadableStream();
  }
}

export type TTerminalCommandSuggestionsProviderFn = (
  message: string,
  token: CancellationToken,
) => MaybePromise<ITerminalCommandSuggestionDesc[] | TerminalSuggestionReadableStream>;

export interface ITerminalProviderRegistry {
  registerCommandSuggestionsProvider(provider: TTerminalCommandSuggestionsProviderFn): void;
}

export type IIntelligentCompletionProvider = (
  editor: ICodeEditor,
  position: IPosition,
  contextBean: IAICompletionOption,
  token: CancellationToken,
) => MaybePromise<IIntelligentCompletionsResult>;

export type ICodeEditsProvider = (
  editor: ICodeEditor,
  position: IPosition,
  contextBean: ICodeEditsContextBean,
  token: CancellationToken,
) => MaybePromise<ICodeEditsResult | undefined>;

export type IIntelligentInlineEditProvider = (
  editor: ICodeEditor,
  position: IPosition,
  contextBean: IAICompletionOption,
  token: CancellationToken,
) => MaybePromise<IIntelligentCompletionsResult>;

/**
 * Interface for registering intelligent completion providers and code edits providers.
 */
export interface IIntelligentCompletionsRegistry {
  /**
   * Registers an intelligent completion provider.
   * @deprecated Use the `registerInlineCompletionsProvider` method instead.
   * @param provider - The intelligent completion provider to register.
   */
  registerIntelligentCompletionProvider(provider: IIntelligentCompletionProvider): void;

  /**
   * Registers an inline completions provider.
   * @param provider - The intelligent completion provider to register.
   */
  registerInlineCompletionsProvider(provider: IIntelligentCompletionProvider): void;

  /**
   * Registers an inline edit provider.
   * @param provider The inline edit provider to register.
   */
  registerInlineEditProvider(provider: InlineEditProvider): void;

  /**
   * Registers a code edits provider.
   * @param provider - The code edits provider to register.
   */
  registerCodeEditsProvider(provider: ICodeEditsProvider): void;
}

export interface IProblemFixContext {
  marker: IMarker;
  editRange: IRange;
}

export interface IHoverFixHandler {
  provideFix: (
    editor: ICodeEditor,
    context: IProblemFixContext,
    token: CancellationToken,
  ) => MaybePromise<ChatResponse | InlineChatController>;
}

export interface IProblemFixProviderRegistry {
  registerHoverFixProvider(handler: IHoverFixHandler): void;
}

export const AINativeCoreContribution = Symbol('AINativeCoreContribution');

export interface AINativeCoreContribution {
  /**
   * 注册 inline chat 相关功能
   * @param registry: IInlineChatFeatureRegistry
   */
  registerInlineChatFeature?(registry: IInlineChatFeatureRegistry): void;
  /*
   * 注册 chat 面板相关功能
   */
  registerChatFeature?(registry: IChatFeatureRegistry): void;
  /*
   * 注册 chat 面板相关渲染层，可以自定义 render
   */
  registerChatRender?(registry: IChatRenderRegistry): void;
  /*
   * 注册智能解决冲突相关功能
   */
  registerResolveConflictFeature?(registry: IResolveConflictRegistry): void;
  /**
   * 注册智能重命名相关功能
   */
  registerRenameProvider?(registry: IRenameCandidatesProviderRegistry): void;
  /**
   * 注册智能修复相关功能
   */
  registerProblemFixFeature?(registry: IProblemFixProviderRegistry): void;
  /**
   * 注册智能终端相关功能
   */
  registerTerminalProvider?(registry: ITerminalProviderRegistry): void;
  /**
   * 注册智能代码补全相关功能
   * proposed api
   */
  registerIntelligentCompletionFeature?(registry: IIntelligentCompletionsRegistry): void;

  /**
   * 注册 Agent 模式下的 chat prompt provider
   * @param provider
   */
  registerChatAgentPromptProvider?(): void;
}

// MCP Server 的 贡献点
export const MCPServerContribution = Symbol('MCPServerContribution');

export const TokenMCPServerRegistry = Symbol('TokenMCPServerRegistry');

export interface MCPServerContribution {
  registerMCPServer(registry: IMCPServerRegistry): void;
}

export interface MCPLogger {
  appendLine(message: string): void;
}

export interface MCPToolDefinition {
  name: string;
  label?: string;
  description: string;
  inputSchema: ZodSchema<any>; // JSON Schema
  handler: (
    args: any,
    logger: MCPLogger,
  ) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
}

export interface IMCPServerToolComponentProps {
  state?: 'streaming-start' | 'streaming' | 'complete' | 'result';
  args?: Record<string, any>;
  result?: any;
  index?: number;
  messageId?: string;
  toolCallId: string;
}

export interface IMCPServerRegistry {
  activeMessageInfo: { messageId: string; sessionId: string };
  registerMCPTool(tool: MCPToolDefinition): void;
  getMCPTools(): MCPToolDefinition[];
  getMCPTool(name: string): MCPToolDefinition | undefined;
  registerToolComponent(name: string, component: React.FC<IMCPServerToolComponentProps>): void;
  getToolComponent(name: string): React.FC<IMCPServerToolComponentProps> | undefined;
  callMCPTool(
    name: string,
    args: any,
  ): Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
  // 后续支持其他 MCP 功能
}

export interface IChatComponentConfig {
  id: string;
  component: React.ComponentType<Record<string, unknown>>;
  initialProps: Record<string, unknown>;
}

export interface IChatAgentViewService {
  registerChatComponent(component: IChatComponentConfig): IDisposable;
  getChatComponent(componentId: string): IChatComponentConfig | null;
  getChatComponentDeferred(componentId: string): Deferred<IChatComponentConfig> | null;
}

/**
 * @deprecated use registerIntelligentCompletionProvider API
 */
export type IProvideInlineCompletionsSignature = (
  this: void,
  model: ITextModel,
  position: Position,
  token: CancellationToken,
  next: (reqBean: IAICompletionOption) => MaybePromise<IAICompletionResultModel | null>,
  requestOption: IAICompletionOption,
) => MaybePromise<IAICompletionResultModel | null>;

/**
 * @deprecated use registerIntelligentCompletionProvider API
 */
export interface IAIMiddleware {
  language?: {
    provideInlineCompletions?: IProvideInlineCompletionsSignature;
  };
}
