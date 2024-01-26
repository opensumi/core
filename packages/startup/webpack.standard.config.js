const path = require('path');

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const { createWebpackConfig, createNodeWebpackConfig } = require('@opensumi/ide-dev-tool/src/webpack');

const web = createWebpackConfig(__dirname, path.join(__dirname, 'entry/web/app.tsx'), {
  mode: process.env.NODE_ENV || 'development',
  plugins: [process.env.analysis && new BundleAnalyzerPlugin()].filter(Boolean),
});

const node = createNodeWebpackConfig(
  path.join(__dirname, 'entry/web/server-prod.ts'),
  path.join(__dirname, 'dist-node/server'),
);

module.exports = [web, node];
