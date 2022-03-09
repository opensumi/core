const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const { createWebpackConfig } = require('@opensumi/ide-dev-tool/src/webpack');

module.exports = createWebpackConfig(__dirname, require('path').join(__dirname, 'entry/web/app.tsx'), {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  plugins: [].concat(process.env.analysis ? new BundleAnalyzerPlugin() : null).filter(Boolean),
});
