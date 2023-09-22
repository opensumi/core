const path = require('path');

const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const webpack = require('webpack');

const tsConfigPath = path.join(__dirname, './tsconfig.json');
const srcDir = path.join(__dirname, './src');
const distDir = path.join(__dirname, './dist');

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  entry: path.join(srcDir, './index.ts'),
  target: 'node',
  output: {
    filename: 'cli.js',
    path: distDir,
  },
  devtool: false,
  mode: 'production',
  node: false,
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
      }),
    ],
  },
  module: {
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
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
  },
  plugins: [!process.env.CI && new webpack.ProgressPlugin()].filter(Boolean),
};
