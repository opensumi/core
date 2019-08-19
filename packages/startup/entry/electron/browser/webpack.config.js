// tslint:disable:no-var-requires
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

const tsConfigPath = path.join(__dirname, '../../../../../tsconfig.json');

module.exports = {
  entry: path.join(__dirname, './index.ts'),
  node: {
    net: "empty",
    child_process: "empty",
    path: true,
    url: false,
    fs: "empty",
    Buffer: false
  },
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [new TsconfigPathsPlugin({
      configFile: tsConfigPath,
    })]
  },
  mode: 'development',
  devtool: 'eval',
  module: {
    // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
    exprContextCritical: false,
    rules: [{
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          configFile: tsConfigPath
        }
      },
      {
        test: /\.png$/,
        use: 'file-loader',
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.module.less$/,
        use: [{
            loader: "style-loader"
          },
          {
            loader: "css-loader",
            options: {
              sourceMap: true,
              modules: true,
              localIdentName: "[local]___[hash:base64:5]"
            }
          },
          {
            loader: "less-loader"
          }
        ]
      },
      {
        test: /^((?!\.module).)*less$/,
        loader: 'style!css!less'
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: 'fonts/'
          }
        }]
      }
    ],
  },
  resolveLoader: {
    modules: [path.join(__dirname, '../../../../node_modules'), path.join(__dirname, '../../../node_modules'), path.resolve('../../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
    moduleExtensions: ['-loader'],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: __dirname + '/index.html',
    }),

    new MiniCssExtractPlugin({
      filename: '[name].[chunkhash:8].css',
      chunkFilename: '[id].css',
    }),
    new webpack.DefinePlugin({
      'process.env.CORE_EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../../core-extensions/')),
      'process.env.EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../../../../tools/extensions')),
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
    new CopyPlugin([
      { from: path.join(__dirname, './vendor'), to: path.join(__dirname, './dist')},
    ]),
  ],
};
