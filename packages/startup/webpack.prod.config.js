const path = require('path');

const {
  createWebpackConfig,
  createNodeWebpackConfig,
  createWebviewWebpackConfig,
} = require('@opensumi/ide-dev-tool/src/webpack');

const web = createWebpackConfig(__dirname, path.join(__dirname, 'entry/web/prod/app.tsx'));

const node = createNodeWebpackConfig(
  path.join(__dirname, 'entry/web/prod/server.ts'),
  path.join(__dirname, 'dist-node/server'),
);

const webview = createWebviewWebpackConfig(
  require.resolve('@opensumi/ide-webview/lib/webview-host/web-preload.js'),
  __dirname,
  '/dist/webview',
);

if (process.env.ONLY_NODE) {
  module.exports = [node];
} else {
  module.exports = [web, node, webview];
}
