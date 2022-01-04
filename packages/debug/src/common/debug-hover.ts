import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export interface IDebugHoverWidget extends monaco.editor.IContentWidget {
  show: (options?: ShowDebugHoverOptions | undefined) => void;
  hide: (options?: ShowDebugHoverOptions | undefined) => void;
}

export interface ShowDebugHoverOptions {
  /**
   * 选中区域
   */
  selection: monaco.Range;
  /**
   * 是否为焦点
   * 默认值：false
   */
  focus?: boolean;
  /**
   * 是否立即调用，当为true时会清理之前的队列
   * 默认值：true
   */
  immediate?: boolean;
}

export interface HideDebugHoverOptions {
  /**
   * 是否立即调用，当为true时会清理之前的队列
   * 默认值：true
   */
  immediate?: boolean;
}
