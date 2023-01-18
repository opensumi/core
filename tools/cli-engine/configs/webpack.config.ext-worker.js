// tslint:disable:no-var-requires
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const path = require('path');

const tsConfigPath = path.join(__dirname, './tsconfig.json');
const distDir = path.join(__dirname, '../lib/browser');

module.exports = {
  entry: require.resolve('@opensumi/ide-extension/lib/hosted/worker.host-preload.js'),
  output: {
    filename: 'worker-host.js',
    path: distDir,
  },
  target: 'webworker',
  node: {
    net: "empty",
  },
  devtool: 'none',
  mode: 'production',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [new TsconfigPathsPlugin({
      configFile: tsConfigPath,
    })],
  },
  module: {
    // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
    exprContextCritical: false,
    rules: [{
      test: /\.tsx?$/,
      loader: 'ts-loader',
      options: {
        configFile: tsConfigPath,
      },
    },
    ],
  },
  resolveLoader: {
    modules: [path.join(__dirname, '../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
    moduleExtensions: ['-loader'],
  },
};
