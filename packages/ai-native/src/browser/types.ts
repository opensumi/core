import { CancellationToken, MaybePromise } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import type * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IAiBackService } from '../common/index';

export type InlineChatOperationalRenderType = 'button' | 'dropdown';

export interface InlineChatAction {
  /**
   * 唯一标识的 id
   */
  id: string;
  /**
   * 用于展示的名称
   */
  name: string;
  /**
   * hover 上去的 popover 提示
   */
  title?: string;
  renderType?: InlineChatOperationalRenderType;
  /**
   * 排序
   */
  order?: number;
}

export class ReplyResponse {
  constructor(readonly message: string) {}
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
  execute?: (editor: IEditor) => MaybePromise<void>;
  /**
   * 提供 diff editor 的预览策略
   */
  providerDiffPreviewStrategy?: (
    editor: IEditor,
    cancelToken: CancellationToken,
  ) => MaybePromise<ReplyResponse | ErrorResponse | CancelResponse>;
}

export const IInlineChatFeatureRegistry = Symbol('IInlineChatFeatureRegistry');

export interface IInlineChatFeatureRegistry {
  registerInlineChat(operational: InlineChatAction, handler: InlineChatHandler): void;
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

  registerRequest(request: IAiBackService['request']): void;

  registerStreamRequest(streamRequest: IAiBackService['requestStream']): void;

  getRuns(): AiRunHandler[];

  getAnswerComponent(): React.FC<IAiRunAnswerComponentProps> | undefined;

  getRequest(): IAiBackService['request'];

  getStreamRequest(): IAiBackService['requestStream'];
}

export const AiNativeCoreContribution = Symbol('AiNativeCoreContribution');

export type provideInlineCompletionsSignature<T> = (
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: CancellationToken,
  ) => monaco.languages.ProviderResult<T>;

export interface IAiMiddleware {
  language?: {
    provideInlineCompletions?: <T extends monaco.languages.InlineCompletions = monaco.languages.InlineCompletions>(
      model: monaco.editor.ITextModel,
      position: monaco.Position,
      context: monaco.languages.InlineCompletionContext,
      token: CancellationToken,
      next: provideInlineCompletionsSignature<T>,
    ) => monaco.languages.ProviderResult<T>;
  };
}

export interface AiNativeCoreContribution {
  /**
   * 注册 ai run 的能力
   * @param registry
   */
  registerRunFeature?(registry: IAiRunFeatureRegistry): void;
  /**
   * 注册 inline chat
   * @param registry
   */
  registerInlineChatFeature?(registry: IInlineChatFeatureRegistry): void;
  /**
   * 通过中间件扩展部分 ai 能力
   */
  middleware?: IAiMiddleware;
}
