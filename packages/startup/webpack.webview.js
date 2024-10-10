const { createWebviewWebpackConfig } = require('@opensumi/ide-dev-tool/src/webpack');
let entry = null;
try {
  entry = require.resolve('@opensumi/ide-webview/src/webview-host/web-preload.ts');
} catch (e) {
  entry = require.resolve('@opensumi/ide-webview/lib/webview-host/web-preload.js');
}
module.exports = createWebviewWebpackConfig(entry, __dirname);
