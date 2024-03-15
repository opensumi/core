import React from 'react';

import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import {
  CancellationToken,
  Deferred,
  IAICompletionResultModel,
  IDisposable,
  MaybePromise,
} from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';

import { IChatWelcomeMessageContent, ISampleQuestions } from '../common';

import { CompletionRequestBean } from './inline-completions/model/competionModel';

import type * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export class ReplyResponse {
  constructor(readonly message: string) {}

  static is(response: any): boolean {
    return response instanceof ReplyResponse || (typeof response === 'object' && response.message !== undefined);
  }
}

export class ErrorResponse {
  constructor(readonly error: any, readonly message?: string) {}

  static is(response: any): boolean {
    return response instanceof ErrorResponse || (typeof response === 'object' && response.error !== undefined);
  }
}

export class CancelResponse {
  readonly cancellation: boolean = true;

  constructor(readonly message?: string) {}

  static is(response: any): boolean {
    return response instanceof CancelResponse || (typeof response === 'object' && response.cancellation !== undefined);
  }
}

export interface InlineChatHandler {
  /**
   * 直接执行 action 的操作，点击后 inline chat 立即消失
   */
  execute?: (editor: ICodeEditor) => MaybePromise<void>;
  /**
   * 提供 diff editor 的预览策略
   */
  providerDiffPreviewStrategy?: (
    editor: ICodeEditor,
    cancelToken: CancellationToken,
  ) => MaybePromise<ReplyResponse | ErrorResponse | CancelResponse>;
}

export const IInlineChatFeatureRegistry = Symbol('IInlineChatFeatureRegistry');
export const IChatFeatureRegistry = Symbol('IChatFeatureRegistry');

export interface IInlineChatFeatureRegistry {
  registerInlineChat(operational: AIActionItem, handler: InlineChatHandler): void;
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
export interface IChatSlashCommandHandler {
  execute: (value: string, send: TChatSlashCommandSend, editor?: ICodeEditor) => MaybePromise<void>;
  providerInputPlaceholder?: (value: string, editor?: ICodeEditor) => string;
  providerPrompt?: (value: string, editor?: ICodeEditor) => MaybePromise<string>;
}

export interface IChatFeatureRegistry {
  registerWelcome(content: IChatWelcomeMessageContent | React.ReactNode, sampleQuestions?: ISampleQuestions[]): void;
  registerSlashCommand(command: IChatSlashCommandItem, handler: IChatSlashCommandHandler): void;
}

export const AINativeCoreContribution = Symbol('AINativeCoreContribution');

export interface AINativeCoreContribution {
  /**
   * 注册 inline chat 相关功能
   * @param registry: IInlineChatFeatureRegistry
   */
  registerInlineChatFeature?(registry: IInlineChatFeatureRegistry): void;
  /**
   * 通过中间件扩展部分 ai 能力
   */
  middleware?: IAIMiddleware;

  /*
   * 注册 chat 面板相关功能
   */
  registerChatFeature?(registry: IChatFeatureRegistry): void;
}

export interface IChatComponentConfig {
  id: string;
  component: React.ComponentType<Record<string, unknown>>;
  initialProps: Record<string, unknown>;
}

export const IChatAgentViewService = Symbol('IChatAgentViewService');

export interface IChatAgentViewService {
  registerChatComponent(component: IChatComponentConfig): IDisposable;
  getChatComponent(componentId: string): IChatComponentConfig | null;
  getChatComponentDeferred(componentId: string): Deferred<IChatComponentConfig> | null;
}

export type IProvideInlineCompletionsSignature = (
  this: void,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  token: CancellationToken,
  next: (reqBean: CompletionRequestBean) => MaybePromise<IAICompletionResultModel | null>,
  completionRequestBean: CompletionRequestBean,
) => MaybePromise<IAICompletionResultModel | null>;

export interface IAIMiddleware {
  language?: {
    provideInlineCompletions?: IProvideInlineCompletionsSignature;
  };
}
