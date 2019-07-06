export interface NewWindowOptions {
  readonly external?: boolean;
}

export const WindowService = Symbol('WindowService');
export interface WindowService {
  /**
   * 打开新的window窗口
   * @param {string} url
   * @param {NewWindowOptions} [options]
   * @returns {(Window | undefined)}
   * @memberof WindowService
   */
  openNewWindow(url: string, options?: NewWindowOptions): Window | undefined;

  /**
   * 当 `window` 在 `unload` 事件触发时
   * 参考 [`BeforeUnloadEvent`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
   *
   * @returns {boolean}
   * @memberof WindowService
   */
  canUnload(): boolean;

}
