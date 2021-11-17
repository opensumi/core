const { createWebviewWebpackConfig } = require('@ide-framework/ide-dev-tool/src/webpack');
let entry = null;
try {
  entry = require.resolve('@ide-framework/ide-webview/src/webview-host/web-preload.ts')
} catch(e) {
  entry = require.resolve('@ide-framework/ide-webview/lib/webview-host/web-preload.js')
}
module.exports = createWebviewWebpackConfig(entry, __dirname);
