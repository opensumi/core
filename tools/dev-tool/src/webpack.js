// tslint:disable:no-var-requires
const path = require('path');

const CopyPlugin = require('copy-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const fse = require('fs-extra');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const threadLoader = require('thread-loader');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const webpack = require('webpack');
const merge = require('webpack-merge');

threadLoader.warmup({}, ['ts-loader']);

const utils = require('./utils');

const reactPath = path.resolve(path.join(__dirname, '../../../node_modules/react'));
const reactDOMPath = path.resolve(path.join(__dirname, '../../../node_modules/react-dom'));
const tsConfigPath = path.join(__dirname, '../../../tsconfig.json');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.IDE_FRONT_PORT || 8080;

const defaultWorkspace = path.join(__dirname, '../../workspace');
fse.mkdirpSync(defaultWorkspace);

// eslint-disable-next-line no-console
console.log('front port', PORT);

const styleLoader =
  process.env.NODE_ENV === 'production' ? MiniCssExtractPlugin.loader : require.resolve('style-loader');

exports.createWebpackConfig = function (dir, entry, extraConfig) {
  const webpackConfig = merge(
    {
      entry,
      node: {
        net: 'empty',
        child_process: 'empty',
        path: 'empty',
        url: false,
        fs: 'empty',
        process: 'mock',
      },
      output: {
        filename: 'bundle.js',
        path: dir + '/dist',
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
        plugins: [
          new TsconfigPathsPlugin({
            configFile: tsConfigPath,
          }),
        ],
        alias: {
          react: reactPath,
          'react-dom': reactDOMPath,
        },
      },
      bail: true,
      mode: 'development',
      devtool: 'inline-cheap-source-map',
      module: {
        // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
        exprContextCritical: false,
        rules: [
          {
            test: /\.tsx?$/,
            use: [
              process.env.NODE_ENV === 'production'
                ? {
                    loader: 'cache-loader',
                    options: {
                      cacheDirectory: path.resolve(__dirname, '../../../.cache'),
                    },
                  }
                : null,
            ]
              .filter(Boolean)
              .concat([
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
              ]),
          },
          {
            test: /\.png$/,
            use: 'file-loader',
          },
          {
            test: /\.css$/,
            use: [styleLoader, 'css-loader'],
          },
          {
            test: /\.module.less$/,
            use: [
              styleLoader,
              {
                loader: 'css-loader',
                options: {
                  importLoaders: 1,
                  sourceMap: true,
                  modules: true,
                  localIdentName: '[local]___[hash:base64:5]',
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
          {
            test: /^((?!\.module).)*less$/,
            use: [
              styleLoader,
              {
                loader: 'css-loader',
                options: {
                  importLoaders: 1,
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
          {
            test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
            use: [
              {
                loader: 'file-loader',
                options: {
                  name: '[name].[ext]',
                  outputPath: 'fonts/',
                },
              },
            ],
          },
        ],
      },
      resolveLoader: {
        modules: [
          path.join(__dirname, '../../../node_modules'),
          path.join(__dirname, '../node_modules'),
          path.resolve('node_modules'),
        ],
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
          'process.env.IS_DEV': JSON.stringify(process.env.NODE_ENV === 'development' ? 1 : 0),
          'process.env.WORKSPACE_DIR': JSON.stringify(process.env.MY_WORKSPACE || defaultWorkspace),
          'process.env.EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../extensions')),
          'process.env.KTLOG_SHOW_DEBUG': JSON.stringify('1'),
          'process.env.OTHER_EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../../other')),
          'process.env.EXTENSION_WORKER_HOST': JSON.stringify(
            process.env.EXTENSION_WORKER_HOST ||
              `http://${HOST}:8080/assets` + path.join(__dirname, '../../../packages/extension/lib/worker-host.js'),
          ),
          'process.env.WS_PATH': JSON.stringify(process.env.WS_PATH || `ws://${HOST}:8000`),
          'process.env.WEBVIEW_HOST': JSON.stringify(process.env.WEBVIEW_HOST || HOST),
          'process.env.STATIC_SERVER_PATH': JSON.stringify(process.env.STATIC_SERVER_PATH || `http://${HOST}:8000/`),
        }),
        new FriendlyErrorsWebpackPlugin({
          compilationSuccessInfo: {
            messages: [`Your application is running here: http://${HOST}:${PORT}`],
          },
          onErrors: utils.createNotifierCallback(),
          clearConsole: true,
        }),
        new ForkTsCheckerWebpackPlugin({
          typescript: {
            diagnosticOptions: {
              syntactic: true,
            },
            configFile: tsConfigPath,
          },
          issue: {
            include: (issue) => issue.file.includes('src/packages/'),
            exclude: (issue) => issue.file.includes('__test__'),
          },
        }),
      ],
      devServer: {
        contentBase: dir + '/dist',
        port: PORT,
        disableHostCheck: true,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
          },
          '/extension': {
            target: 'http://localhost:8000',
          },
          '/assets': {
            target: 'http://localhost:8000',
          },
          '/kaitian': {
            target: 'http://localhost:8000',
          },
          '/socket.io': {
            ws: true,
            target: 'ws://localhost:8000',
          },
        },
        stats: 'errors-only',
        overlay: true,
        open: process.env.SUMI_DEV_OPEN_BROWSER ? true : false,
        hot: true,
      },
    },
    extraConfig,
  );

  return webpackConfig;
};

exports.createWebviewWebpackConfig = (entry, dir) => {
  const port = 8899;
  return {
    entry,
    node: {
      net: 'empty',
      child_process: 'empty',
      path: 'empty',
      url: false,
      fs: 'empty',
      process: 'mock',
    },
    output: {
      filename: 'webview.js',
      path: dir + '/dist',
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
            happyPackMode: true,
            transpileOnly: true,
            configFile: tsConfigPath,
          },
        },
      ],
    },
    resolveLoader: {
      modules: [
        path.join(__dirname, '../../../node_modules'),
        path.join(__dirname, '../node_modules'),
        path.resolve('node_modules'),
      ],
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
      disableHostCheck: true,
      port,
      host: '0.0.0.0',
      quiet: true,
      overlay: true,
      open: false,
      hot: true,
    },
  };
};
