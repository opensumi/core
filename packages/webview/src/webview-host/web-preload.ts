/* istanbul ignore file */
import { IWebviewChannel } from './common';
import { WebviewPanelManager } from './webview-manager';

export class WebIframeChannel implements IWebviewChannel {

  private handlers = new Map();
  focusIframeOnCreate?: boolean | undefined;
  ready?: Promise<void> | undefined;
  fakeLoad: boolean = false;
  private isInDevelopmentMode = false;
  private id = document!.location!.search!.match(/\bid=([\w-]+)/)![1];

  constructor() {
    window.addEventListener('message', (e) => {
      if (e.data && (e.data.command === 'onmessage' || e.data.command === 'do-update-state')) {
        // Came from inner iframe
        this.postMessage(e.data.command, e.data.data);
        return;
      }

      const channel = e.data.channel;
      const handler = this.handlers.get(channel);
      if (handler) {
        handler(e, e.data.data);
      } else {
        // tslint:disable-next-line:no-console
        console.log('no handler for ', e);
      }
    });

    this.ready = new Promise<void>(async (resolve) => {
      // TODO 等待service worker完成  未来资源使用service worker时需要加入
      resolve();
    });

    this.onMessage('devtools-opened', () => {
      this.isInDevelopmentMode = true;
    });
  }

  get inDev() {
    return this.isInDevelopmentMode;
  }

  postMessage(channel, data?) {
    if (window.parent !== window) {
      window.parent.postMessage({ target: this.id, channel, data }, '*');
    }
  }

  onMessage(channel, handler) {
    this.handlers.set(channel, handler);
  }

  onIframeLoaded(newFrame) {
    // newFrame.contentWindow.onbeforeunload = () => {
    //   if (this.isInDevelopmentMode) { // Allow reloads while developing a webview
    //     this.postMessage('do-reload');
    //     return false;
    //   }
    //   // Block navigation when not in development mode
    //   console.log('prevented webview navigation');
    //   return false;
    // };
  }

  onKeydown(event: KeyboardEvent) {
    // 在浏览器上，需要阻止一些默认的keydown快捷键
    if (event.key === 's' && (event.metaKey || event.ctrlKey) ) {
      // 阻止保存
      event.preventDefault();
    }
  }
}

/* tslint:disable */
new WebviewPanelManager(new WebIframeChannel());
/* tslint:enable */
