import { IDisposable, Event } from '@opensumi/ide-core-common';

export interface IWindowInfo {
  windowId: number;
  webContentsId: number;
}
export interface IMainThreadIDEWindow {
  $createWebviewWindow(
    webviewId: string,
    options?: IIDEWindowWebviewOptions,
    env?: IIDEWindowWebviewEnv,
  ): Promise<IWindowInfo>;
  $show(webviewId: string): Promise<void>;
  $hide(webviewId: string): Promise<void>;
  $postMessage(webviewId: string, message: any): Promise<void>;
  $loadURL(webviewId: string, url: string): Promise<void>;
  $destroy(webviewId: string): Promise<void>;
  $setSize(webviewId: string, size: { width: number; height: number }): Promise<void>;
  $setAlwaysOnTop(webviewId: string, flag: boolean): Promise<void>;
}

export interface IExtHostIDEWindow {
  $postMessage(webviewId: string, message: any): Promise<void>;
  $dispatchClosed(webviewId: string): Promise<void>;
}

export interface IIDEWindowWebviewOptions {
  /**
   * 窗口宽度，默认 `800`
   */
  width?: number;
  /**
   * 窗口高度，默认 `600`
   */
  height?: number;

  [key: string]: any;
}

export interface IIDEWindowWebviewEnv {
  /**
   * 注入webview中的环境变量
   */
  [key: string]: any;
}

export interface IExtPlainWebviewWindow extends IDisposable {
  /**
   * 加载webview窗口内的资源地址
   * @param url
   */
  loadUrl(url: string): Promise<void>;
  /**
   * 隐藏webview窗口
   */
  hide(): Promise<void>;
  /**
   * 展示webview窗口
   */
  show(): Promise<void>;
  /**
   * 设置webview窗口大小
   * @param size
   */
  setSize(size: { width: number; height: number }): Promise<void>;
  /**
   * 设置webview窗口是否置顶
   * @param flag
   */
  setAlwaysOnTop(flag: boolean): Promise<void>;
  /**
   * 传递消息至webview窗口
   * @param message
   */
  postMessage(message: any): Promise<void>;
  /**
   * 接收webview窗口回传消息事件
   */
  onMessage: Event<any>;
  /**
   * 接收webview窗口关闭事件
   */
  onClosed: Event<void>;
}
