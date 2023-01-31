/* eslint-disable no-console */
import { IWebviewChannel } from './common';
import { WebviewPanelManager } from './webview-manager';

class WebIframeChannel implements IWebviewChannel {
  private handlers = new Map();
  focusIframeOnCreate?: boolean | undefined;
  ready?: Promise<void> | undefined;
  fakeLoad = false;
  private id = document?.location?.search?.match(/\bid=([\w-]+)/)?.[1];

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
        console.log('no handler for ', e);
      }
    });

    // eslint-disable-next-line no-async-promise-executor
    this.ready = new Promise<void>(async (resolve) => {
      resolve();
    });

    this.onMessage('devtools-opened', () => {});
  }

  postMessage(channel, data?) {
    if (window.parent !== window) {
      window.parent.postMessage({ target: this.id, channel, data }, '*');
    }
  }

  onMessage(channel, handler) {
    this.handlers.set(channel, handler);
  }
}

/* tslint:disable */
new WebviewPanelManager(new WebIframeChannel());
/* tslint:enable */
