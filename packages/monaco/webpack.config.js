const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: {
    'editor.worker': '@opensumi/monaco-editor-core/esm/vs/editor/editor.worker.js',
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  output: {
    globalObject: 'self',
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'worker'),
    clean: true,
    publicPath: '',
  },
  optimization:
    process.env.NODE_ENV === 'production'
      ? {
          minimize: true,
          minimizer: [new TerserPlugin()],
        }
      : {},
  plugins: [new WebpackManifestPlugin({})],
  stats: process.env.CI ? 'errors-only' : 'normal',
};
