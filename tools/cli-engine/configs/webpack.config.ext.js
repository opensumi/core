const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const path = require('path');

const tsConfigPath = path.join(__dirname, './tsconfig.json');
const distDir = path.join(__dirname, '../lib/hosted');

module.exports = {
  entry: require.resolve('@opensumi/ide-extension/lib/hosted/ext.process.js'),
  target: 'node',
  output: {
    filename: 'ext.process.js',
    path: distDir,
  },
  devtool: 'source-map',
  node: false,
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
      }),
    ],
  },
  mode: 'development',
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
  externals: [
    function (context, request, callback) {
      if (['node-pty', 'nsfw', 'spdlog'].indexOf(request) !== -1) {
        return callback(null, `commonjs ${request}`);
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
