const path = require('path');

const CopyPlugin = require('copy-webpack-plugin');

const {
  createWebpackConfig,
  createNodeWebpackConfig,
  createWebviewWebpackConfig,
} = require('@opensumi/ide-dev-tool/src/webpack');

const web = createWebpackConfig(__dirname, path.join(__dirname, 'entry/web/prod/app.tsx'), {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.join(__dirname, '../extension/lib/worker-host.js'),
          to: path.join(__dirname, './dist/worker-host.js'),
        },
      ],
    }),
  ],
});

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
