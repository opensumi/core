import { Event } from '@opensumi/ide-core-common';

export interface IPlainWebviewHandle {
  /**
   * 向webview内部发送消息
   * @param message
   */
  postMessage(message: any): Promise<boolean>;

  /**
   * 接收到 WebView 内消息
   */
  onMessage: Event<any>;

  /**
   * A string that sets the session used by the page.
   */
  setPartition(value?: string): Promise<void>;

  /**
   * 加载一个 url
   */
  loadUrl(url: string): Promise<void>;
}

export interface IExtHostPlainWebview extends IPlainWebviewHandle {
  reveal(groupIndex: number);
}

export interface ISumiExtHostWebviews {
  $acceptMessage(id: string, message: any): void;
}
