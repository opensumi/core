const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const tsConfigPath = path.join(__dirname, './tsconfig.json');
const distDir = path.join(__dirname, '../lib/node/webview');

module.exports = {
  entry: path.join(__dirname, '../src/webview/webview-host/web-preload.ts'),
  node: {
    net: 'empty',
    'child_process': 'empty',
    path: 'empty',
    url: false,
    fs: 'empty',
    process: 'mock',
  },
  output: {
    filename: 'webview.js',
    path: distDir,
  },
  resolve: {
    extensions: ['.ts'],
  },
  bail: true,
  mode: 'production',
  devtool: false,
  module: {
    // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
    exprContextCritical: false,
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          configFile: tsConfigPath,
        },
      },
    ],
  },
  resolveLoader: {
    modules: [
      path.join(__dirname, '../node_modules'),
      path.resolve('node_modules'),
    ],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
    moduleExtensions: ['-loader'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(
        __dirname,
        '../src/webview/webview-host/webview.html',
      ),
    }),
  ],
};
