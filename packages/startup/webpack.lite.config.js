const path = require('path');

const { createWebpackConfig } = require('@opensumi/ide-dev-tool/src/webpack');
const webpack = require('webpack');
const ServiceWorkerWebpackPlugin = require('serviceworker-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = createWebpackConfig(__dirname, require('path').join(__dirname, 'entry/web-lite/app.tsx'), {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devServer: {
    proxy: require('./proxy-map'),
  },
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
  plugins: [
    new webpack.DefinePlugin({
      'process.env.SCM_PLATFORM': JSON.stringify(process.env.SCM_PLATFORM),
      'process.env.LSIF_HOST': JSON.stringify(process.env.LSIF_HOST),
      'process.env.PROJECT_ID': JSON.stringify(process.env.SCM_PLATFORM === 'aone' ? '1812048' : ''),
    }),
    // Expose BrowserFS, process, and Buffer globals.
    // NOTE: If you intend to use BrowserFS in a script tag, you do not need
    // to expose a BrowserFS global.
    new webpack.ProvidePlugin({ BrowserFS: 'bfsGlobal', process: 'processGlobal', Buffer: 'bufferGlobal' }),
    // service worker
    new ServiceWorkerWebpackPlugin({
      entry: path.join(__dirname, 'entry/web-lite/sw.js'),
    }),
    !process.env.CI && new ProgressPlugin(),
  ]
    .concat(process.env.analysis ? new BundleAnalyzerPlugin() : null)
    .filter(Boolean),
  // DISABLE Webpack's built-in process and Buffer polyfills!
  node: {
    process: false,
    Buffer: false,
  },
});
