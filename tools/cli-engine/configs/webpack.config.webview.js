const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const tsConfigPath = path.join(__dirname, './tsconfig.json');
const distDir = path.join(__dirname, '../lib/node/webview');

module.exports = {
  entry: path.join(__dirname, '../src/webview/webview-host/web-preload.ts'),
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
        loader: require.resolve('ts-loader'),
        options: {
          happyPackMode: true,
          transpileOnly: true,
          configFile: tsConfigPath,
          compilerOptions: {
            target: 'es2015',
          },
        },
      },
    ],
  },
  resolveLoader: {
    modules: [path.join(__dirname, '../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, '../src/webview/webview-host/webview.html'),
    }),
  ],
};
