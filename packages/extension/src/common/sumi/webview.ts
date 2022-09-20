import { Event } from '@opensumi/ide-core-common';

export interface IPlainWebviewHandle {
  /**
   * Post Message to Webview
   * @param message
   */
  postMessage(message: any): Promise<boolean>;

  /**
   * Receive message from Webview
   */
  onMessage: Event<any>;

  /**
   * A string that sets the session used by the page.
   */
  setPartition(value?: string): Promise<void>;

  /**
   * Load url
   */
  loadUrl(url: string): Promise<void>;
}

export interface IExtHostPlainWebview extends IPlainWebviewHandle {
  reveal(groupIndex: number);
}

export interface ISumiExtHostWebviews {
  $acceptMessage(id: string, message: any): void;
}
