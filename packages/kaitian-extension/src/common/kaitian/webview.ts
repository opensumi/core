
import { Event } from '@ide-framework/ide-core-common';

export interface IPlainWebviewHandle {

  /**
   * 向webview内部发送消息
   * @param message
   */
  postMessage(message: any): Promise<boolean>;

  /**
   *
   */
  onMessage: Event<any>;

}

export interface IExtHostPlainWebview extends IPlainWebviewHandle {

  reveal(groupIndex: number);

  loadUrl(url: string);

}

export interface IKaitianExtHostWebviews {

  $acceptMessage(id: string, message: any): void;

}
