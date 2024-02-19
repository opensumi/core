const path = require('path');

const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const tsConfigPath = path.join(__dirname, '../tsconfig.json');
const srcDir = path.join(__dirname, '../src/main');
const distDir = path.join(__dirname, '../app/dist/main');

/** @type { import('webpack').Configuration } */
module.exports = {
  entry: path.join(srcDir, './index.ts'),
  target: 'electron-main',
  output: {
    filename: 'index.js',
    path: distDir,
    clean: true,
  },
  node: false,
  resolve: {
    mainFields: ['main'],
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.json', '.less'],
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
      {
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      },
    ],
  },
  resolveLoader: {
    modules: [path.join(__dirname, '../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
  },
  externals: [
    ({ request }, callback) => {
      if (['node-pty', '@parcel/watcher', 'spdlog', 'nsfw', 'electron'].includes(request)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    },
  ],
};
