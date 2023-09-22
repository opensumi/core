const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { ProgressPlugin } = require('webpack');

const tsConfigPath = path.join(__dirname, '../../configs/ts/references/tsconfig.components.json');

/** @type { import('webpack').Configuration } */
module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: path.join(__dirname, './src/index.ts'),
  output: {
    filename: 'index.js',
    path: path.join(__dirname, './dist'),
  },
  optimization: {
    minimizer: [new OptimizeCSSAssetsPlugin({})],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'index.css',
    }),
    !process.env.CI && new ProgressPlugin(),
    new NodePolyfillPlugin({
      includeAliases: ['process', 'util'],
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
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
        generator: {
          filename: './fonts/[name].[hash:name][ext]',
        },
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'cache-loader',
            options: {
              cacheDirectory: path.resolve(__dirname, '../../../.cache'),
            },
          },
          {
            loader: 'thread-loader',
            options: {
              workers: require('os').cpus().length - 1,
            },
          },
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
              modules: {
                localIdentName: '[local]___[hash:base64:5]',
              },
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
