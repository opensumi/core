import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import { CancellationToken, MaybePromise } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor/lib/browser';

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
  registerInlineChat(operational: AIActionItem, handler: InlineChatHandler): void;
}

export const AINativeCoreContribution = Symbol('AINativeCoreContribution');

export interface AINativeCoreContribution {
  /**
   * 注册 inline chat
   * @param registry
   */
  registerInlineChatFeature?(registry: IInlineChatFeatureRegistry): void;
}
