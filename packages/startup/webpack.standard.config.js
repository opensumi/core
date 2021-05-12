const { createWebpackConfig } = require('@ali/ide-dev-tool/src/webpack');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = createWebpackConfig(
  __dirname,
  require('path').join(__dirname, 'entry/web/app.tsx'),
  {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    plugins: [
    ].concat(process.env.analysis ? new BundleAnalyzerPlugin() : null)
     .filter(Boolean),
  },
);
