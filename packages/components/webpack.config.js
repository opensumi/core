const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { ProgressPlugin } = require('webpack');

const tsConfigPath = path.join(__dirname, '../../configs/ts/references/tsconfig.components.json');

/** @type { import('webpack').Configuration } */
module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.join(__dirname, './src/index.ts'),
  output: {
    filename: 'index.js',
    path: path.join(__dirname, './dist'),
  },
  optimization: {
    minimizer: [new OptimizeCSSAssetsPlugin({})],
  },
  cache: {
    type: 'filesystem',
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'index.css',
    }),
    !process.env.CI && new ProgressPlugin(),
    new NodePolyfillPlugin({
      includeAliases: ['path', 'process', 'util'],
    }),
  ].filter(Boolean),
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.svg$/,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext][query]',
        },
      },
      {
        test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext][query]',
        },
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
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
        test: /\.less$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              sourceMap: false,
            },
          },
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                javascriptEnabled: true,
              },
            },
          },
        ],
      },
    ],
  },
  stats: process.env.CI ? 'errors-only' : 'normal',
};
