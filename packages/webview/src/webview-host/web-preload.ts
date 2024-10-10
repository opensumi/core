/* istanbul ignore file */
import { WebIframeChannel } from './web-iframe-channel';
import { WebviewPanelManager } from './webview-manager';

new WebviewPanelManager(
  new WebIframeChannel(() => {
    const params = new URLSearchParams(document.location.search);
    const id = params.get('id');
    if (id) {
      return id;
    } else {
      throw new Error('Missing "id" parameter in URL');
    }
  }),
);
