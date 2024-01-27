const path = require('path');

const AssetsPlugin = require('assets-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const { lessLoader } = require('./webpack-util');

const tsConfigPath = path.join(__dirname, './tsconfig.json');
const dir = path.join(__dirname, '../src/browser');
const distDir = path.join(__dirname, '../lib/browser');
const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  entry: `${dir}/index.ts`,
  output: {
    filename: 'browser.js',
    path: distDir,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
      }),
    ],
  },
  bail: true,
  mode: nodeEnv,
  devtool: false,
  module: {
    // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
    exprContextCritical: false,
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
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
      {
        test: /\.png$/,
        type: 'asset/resource',
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, require.resolve('css-loader')],
      },
      {
        test: /\.module.less$/,
        use: [
          {
            loader: require.resolve('style-loader'),
          },
          {
            loader: require.resolve('css-loader'),
            options: {
              sourceMap: true,
              modules: true,
            },
          },
          lessLoader(),
        ],
      },
      {
        test: /^((?!\.module).)*less$/,
        use: [
          {
            loader: require.resolve('style-loader'),
          },
          {
            loader: require.resolve('css-loader'),
          },
          lessLoader(),
        ],
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
        generator: {
          filename: '[name][ext]',
          outputPath: 'fonts/',
          publicPath: 'http://localhost:8080/fonts',
        },
      },
    ],
  },
  resolveLoader: {
    modules: [path.join(__dirname, '../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
  },
  optimization: {
    nodeEnv,
    minimizer: [new TerserJSPlugin({}), new OptimizeCSSAssetsPlugin({})],
  },
  plugins: [
    new AssetsPlugin({
      path: distDir,
      filename: 'assets.json',
      prettyPrint: true,
    }),
    new MiniCssExtractPlugin({
      filename: 'main.css',
    }),
    new CopyPlugin({
      patterns: [
        { from: path.join(dir, 'vendor'), to: distDir },
        { from: path.join(dir, 'index.html'), to: distDir },
      ],
    }),
    new NodePolyfillPlugin({
      includeAliases: ['process', 'Buffer'],
    }),
  ],
};
