// tslint:disable:no-var-requires
const path = require('path');

const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const tsConfigPath = path.join(__dirname, '../tsconfig.json');
const distDir = path.join(__dirname, '../app/dist/extension');

const nodeTarget = {
  entry: path.join(__dirname, '../src/extension/index'), // require.resolve('@opensumi/ide-extension/lib/hosted/ext.process.js'),
  target: 'node',
  output: {
    filename: 'index.js',
    path: distDir,
  },
  node: false,
  resolve: {
    mainFields: ['main'],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
      }),
    ],
  },
  mode: 'development',
  devtool: 'source-map',
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
      { test: /\.css$/, loader: require.resolve('null-loader') },
      { test: /\.less$/, loader: require.resolve('null-loader') },
    ],
  },
  externals: [
    function (context, request, callback) {
      if (['node-pty', 'nsfw', 'spdlog'].indexOf(request) !== -1) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    },
  ],
  resolveLoader: {
    modules: [path.join(__dirname, '../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
    moduleExtensions: ['-loader'],
  },
};

const workerTarget = {
  entry: path.join(__dirname, '../src/extension/index.worker'), // require.resolve('@opensumi/ide-extension/lib/hosted/ext.process.js'),
  target: 'webworker',
  output: {
    filename: 'index.worker.js',
    path: distDir,
  },
  node: {
    net: 'empty',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
      }),
    ],
  },
  mode: 'development',
  devtool: 'source-map',
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
      { test: /\.css$/, loader: require.resolve('null-loader') },
      { test: /\.less$/, loader: require.resolve('null-loader') },
    ],
  },
  externals: [
    function (context, request, callback) {
      if (['node-pty', 'nsfw', 'spdlog'].indexOf(request) !== -1) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    },
  ],
  resolveLoader: {
    modules: [path.join(__dirname, '../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
    moduleExtensions: ['-loader'],
  },
};

module.exports = [nodeTarget, workerTarget];
