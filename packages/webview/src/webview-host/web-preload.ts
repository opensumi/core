/* istanbul ignore file */
import { WebIframeChannel } from './web-iframe-channel';
import { WebviewPanelManager } from './webview-manager';

new WebviewPanelManager(new WebIframeChannel(() => document!.location!.search!.match(/\bid=([\w-]+)/)![1]));
