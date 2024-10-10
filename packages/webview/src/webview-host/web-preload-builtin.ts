/* istanbul ignore file */
import { WebIframeChannel } from './web-iframe-channel';
import { WebviewPanelManager } from './webview-manager';

interface ExtendedWindow extends Window {
  channelId: string;
}

new WebviewPanelManager(new WebIframeChannel(() => (window as unknown as ExtendedWindow).channelId));
