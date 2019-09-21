// tslint:disable:no-var-requires
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const path = require('path');
const threadLoader = require('thread-loader');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const darkTheme = require('@ant-design/dark-theme');


threadLoader.warmup({}, [
  'ts-loader',
]);

const utils = require('./utils');

const tsConfigPath = path.join(__dirname, '../../../tsconfig.json');
const port = 8080;

exports.createWebpackConfig = function (dir, entry) {

  return {
    entry,
    node: {
      net: "empty",
      child_process: "empty",
      path: "empty",
      url: false,
      fs: "empty",
      process: "mock"
    },
    output: {
      filename: 'bundle.js',
      path: dir + '/dist',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
      plugins: [new TsconfigPathsPlugin({
        configFile: tsConfigPath
      })]
    },
    bail: true,
    mode: 'development',
    devtool: 'inline-source-map',
    module: {
      // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
      exprContextCritical: false,
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'cache-loader',
              options: {
                cacheDirectory: path.resolve(__dirname, '../../../.cache'),
              }
            },
            {
              loader: 'thread-loader',
              options: {
                workers: require('os').cpus().length - 1,
              }
            },
            {
              loader: 'ts-loader',
              options: {
                happyPackMode: true,
                transpileOnly: true,
                configFile: tsConfigPath,
                compilerOptions: {
                  target: 'es2015'
                }
              },
            },
          ],
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
              loader: 'style-loader'
            },
            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
                modules: true,
                localIdentName: '[local]___[hash:base64:5]'
              }
            },
            {
              loader: 'less-loader',
              options: {
                javascriptEnabled: true
              }
            }
          ]
        },
        {
          test: /^((?!\.module).)*less$/,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'less-loader',
              options: {
                javascriptEnabled: true,
                modifyVars: darkTheme.default
              }
            }
          ],
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
      modules: [path.join(__dirname, '../../../node_modules'), path.join(__dirname, '../node_modules'), path.resolve('node_modules')],
      extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
      mainFields: ['loader', 'main'],
      moduleExtensions: ['-loader'],
    },
    optimization: {
      nodeEnv: process.env.NODE_ENV,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: __dirname + '/index.html',
      }),

      new MiniCssExtractPlugin({
        filename: '[name].[chunkhash:8].css',
        chunkFilename: '[id].css',
      }),
      new webpack.DefinePlugin({
        'process.env.IS_DEV': '1',
        'process.env.WORKSPACE_DIR': JSON.stringify(process.env.MY_WORKSPACE || path.join(__dirname, '../../workspace')),
        'process.env.CORE_EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../core-extensions/')),
        'process.env.EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../extensions')),
        'process.env.KTLOG_SHOW_DEBUG': JSON.stringify('1'),
        'process.env.OTHER_EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../../other')),
        'process.env.EXTENSION_WORKER_HOST': JSON.stringify(path.join(__dirname, '../../../packages/kaitian-extension/lib/worker-host.js')),
      }),
      new FriendlyErrorsWebpackPlugin({
        compilationSuccessInfo: {
            messages: [`Your application is running here: http://localhost:${port}`],
        },
        onErrors: utils.createNotifierCallback(),
        clearConsole: true,
      }),
      new CopyPlugin([
        { from: path.join(__dirname, '../vendor'), to: dir + '/dist' },
      ]),
      new ForkTsCheckerWebpackPlugin({
        checkSyntacticErrors: true,
        tsconfig: tsConfigPath,
        reportFiles: ['packages/**/*.{ts,tsx}']
      }),
    ],
    devServer: {
      contentBase: dir + '/public',
      port,
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
        },
        '/extension': {
          target: 'http://localhost:8000',
        },
        '/kaitian':{
          target: 'http://localhost:8000',
        },
        '/socket.io': {
          ws: true,
          target: 'ws://localhost:8000',
        },
      },
      stats: 'errors-only',
      overlay: true,
      open: process.env.KAITIAN_DEV_OPEN_BROWSER ? true : false,
    }
  };
}


exports.createWebviewWebpackConfig = (entry, dir) => {
  const port = 9090;
  return {
    entry,
    node: {
      net: "empty",
      child_process: "empty",
      path: "empty",
      url: false,
      fs: "empty",
      process: "mock"
    },
    output: {
      filename: 'webview.js',
      path: dir + '/dist',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
      plugins: [new TsconfigPathsPlugin({
        configFile: tsConfigPath
      })]
    },
    bail: true,
    mode: 'development',
    devtool: 'source-map',
    module: {
      // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
      exprContextCritical: false,
      rules: [{
          test: /\.tsx?$/,
          loader: 'ts-loader',
          options: {
            configFile: tsConfigPath,
          }
        },
      ],
    },
    resolveLoader: {
      modules: [path.join(__dirname, '../../../node_modules'), path.join(__dirname, '../node_modules'), path.resolve('node_modules')],
      extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
      mainFields: ['loader', 'main'],
      moduleExtensions: ['-loader'],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.dirname(entry) + '/webview.html',
      }),
    ],
    devServer: {
      contentBase: dir + '/public',
      port,
      host: '127.0.0.1',
      quiet: true,
      overlay: true,
      open: false,
      hot: false,
    }
  }
}
