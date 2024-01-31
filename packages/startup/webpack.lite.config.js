const path = require('path');

const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const baseDir = path.join(__dirname, 'entry/web-lite');

const { createWebpackConfig } = require('@opensumi/ide-dev-tool/src/webpack');
module.exports = createWebpackConfig(baseDir, path.join(baseDir, 'app.tsx'), {
  resolve: {
    alias: {
      fs: 'browserfs/dist/shims/fs.js',
      buffer: 'browserfs/dist/shims/buffer.js',
      path: 'browserfs/dist/shims/path.js',
      processGlobal: 'browserfs/dist/shims/process.js',
      bufferGlobal: 'browserfs/dist/shims/bufferGlobal.js',
      bfsGlobal: require.resolve('browserfs'),
    },
  },
  node: false,
  plugins: [
    new webpack.DefinePlugin({
      global: 'window', // This will replace global with window
    }),
    // Expose BrowserFS, process, and Buffer globals.
    // NOTE: If you intend to use BrowserFS in a script tag, you do not need
    // to expose a BrowserFS global.
    new webpack.ProvidePlugin({ BrowserFS: 'bfsGlobal', process: 'processGlobal', Buffer: 'bufferGlobal' }),
    new CopyPlugin({
      patterns: [
        {
          from: path.join(__dirname, '../extension/lib/worker-host.js'),
          to: path.join(baseDir, './dist/worker-host.js'),
        },
      ],
    }),
    !process.env.CI && new webpack.ProgressPlugin(),
  ]
    .concat(process.env.analysis ? new BundleAnalyzerPlugin() : null)
    .filter(Boolean),
});
