/* istanbul ignore file */
import { WebIframeChannel } from './web-iframe-channel';
import { WebviewPanelManager } from './webview-manager';

new WebviewPanelManager(new WebIframeChannel(() => (window as any).channelId));
