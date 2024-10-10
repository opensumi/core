/* istanbul ignore file */
import { WebIframeChannel, getIdFromSearch } from './web-iframe-channel';
import { WebviewPanelManager } from './webview-manager';

new WebviewPanelManager(new WebIframeChannel(getIdFromSearch));
