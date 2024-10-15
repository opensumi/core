const path = require('path');

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const fse = require('fs-extra');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const webpack = require('webpack');
const { merge } = require('webpack-merge');

const reactPath = path.resolve(path.join(__dirname, '../../../node_modules/react'));
const reactDOMPath = path.resolve(path.join(__dirname, '../../../node_modules/react-dom'));
const tsConfigPath = path.join(__dirname, '../../../tsconfig.json');
const HOST = process.env.HOST || '0.0.0.0';
const IDE_FRONT_PORT = process.env.IDE_FRONT_PORT || 8080;

const defaultWorkspace = path.join(__dirname, '../../workspace');
fse.mkdirpSync(defaultWorkspace);

const withSlash = process.platform === 'win32' ? '/' : '';

const styleLoader =
  process.env.NODE_ENV === 'production' ? MiniCssExtractPlugin.loader : require.resolve('style-loader');

/**
 *
 * @param {string} dir
 * @param {string} entry
 * @param {import('webpack').Configuration} extraConfig
 * @returns {import('webpack').Configuration}
 */
exports.createWebpackConfig = function (dir, entry, extraConfig) {
  console.log('front port', IDE_FRONT_PORT);

  const outputPath = dir + '/dist';
  const webpackConfig = merge(
    {
      entry,
      output: {
        filename: 'bundle.js',
        path: outputPath,
        clean: true,
      },
      cache: {
        type: 'filesystem',
      },
      experiments: {
        asyncWebAssembly: true, // 启用 WebAssembly 支持
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
        fallback: {
          net: false,
          path: false,
          os: false,
          crypto: false,
          child_process: false,
          url: false,
          fs: false,
        },
      },
      bail: true,
      mode: process.env.NODE_ENV || 'development',
      devtool: 'source-map',
      module: {
        // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
        exprContextCritical: false,
        rules: [
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
            test: /\.png$/,
            type: 'asset/resource',
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
      },
      optimization: {
        nodeEnv: process.env.NODE_ENV,
        minimize: false,
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
          'process.env.SUPPORT_LOAD_WORKSPACE_BY_HASH': JSON.stringify(process.env.SUPPORT_LOAD_WORKSPACE_BY_HASH),
          'process.env.EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../extensions')),
          'process.env.KTLOG_SHOW_DEBUG': JSON.stringify('1'),
          'process.env.OTHER_EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../../other')),
          'process.env.EXTENSION_WORKER_HOST': JSON.stringify(
            process.env.EXTENSION_WORKER_HOST ||
              `http://${HOST}:8080/assets` +
                withSlash +
                path.resolve(__dirname, '../../../packages/extension/lib/worker-host.js'),
          ),
          'process.env.WS_PATH': JSON.stringify(process.env.WS_PATH || `ws://${HOST}:8000`),
          'process.env.WEBVIEW_HOST': JSON.stringify(process.env.WEBVIEW_HOST || HOST),
          'process.env.STATIC_SERVER_PATH': JSON.stringify(process.env.STATIC_SERVER_PATH || `http://${HOST}:8000/`),
          'process.env.HOST': JSON.stringify(process.env.HOST),
        }),
        !process.env.SKIP_TS_CHECKER &&
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
        new NodePolyfillPlugin({
          includeAliases: ['process', 'Buffer'],
        }),
        !process.env.CI && new webpack.ProgressPlugin(),
        process.env.analysis && new BundleAnalyzerPlugin(),
      ].filter(Boolean),
      devServer: {
        static: {
          directory: dir + '/dist',
        },
        host: HOST,
        port: IDE_FRONT_PORT,
        allowedHosts: 'all',
        devMiddleware: {
          stats: 'errors-only',
        },
        proxy: [
          {
            context: ['/api', '/extension', '/assets', '/kaitian'],
            target: `http://${HOST}:8000`,
            changeOrigin: true,
          },
        ],
        open: process.env.SUMI_DEV_OPEN_BROWSER ? true : false,
        hot: true,
        client: {
          overlay: {
            errors: true,
            warnings: false,
            runtimeErrors: false,
          },
        },
      },
    },
    extraConfig || {},
  );

  return webpackConfig;
};

/**
 * @returns {import('webpack').Configuration}
 */
exports.createWebviewWebpackConfig = (entry, dir, outputPath = '/dist') => {
  const port = 8899;
  return {
    entry,
    output: {
      filename: 'webview.js',
      path: dir + outputPath,
      clean: true,
    },
    cache: {
      type: 'filesystem',
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
    mode: process.env.NODE_ENV || 'development',
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
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.dirname(entry) + '/webview.html',
      }),
      new NodePolyfillPlugin({
        includeAliases: ['process', 'Buffer'],
      }),
    ],
    devServer: {
      static: {
        directory: dir + '/public',
      },
      allowedHosts: 'all',
      port,
      host: HOST,
      open: false,
      hot: true,
      client: {
        overlay: {
          errors: true,
          warnings: false,
          runtimeErrors: false,
        },
      },
    },
  };
};

/**
 * @returns {import('webpack').Configuration}
 */
exports.createNodeWebpackConfig = (entry, distDir) => ({
  entry,
  target: 'node',
  output: {
    filename: 'server.js',
    path: distDir,
    clean: true,
  },
  node: false,
  mode: process.env.NODE_ENV || 'development',
  devtool: 'source-map',
  optimization: {
    minimize: false,
  },
  cache: {
    type: 'filesystem',
  },
  watch: false,
  resolve: {
    modules: [
      path.join(__dirname, '../../../node_modules'),
      path.join(__dirname, '../node_modules'),
      path.resolve('node_modules'),
    ],
    extensions: ['.ts', '.tsx', '.js', '.json'],
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
        use: [
          {
            loader: 'ts-loader',
            options: {
              happyPackMode: true,
              transpileOnly: true,
              configFile: tsConfigPath,
              compilerOptions: {
                target: 'es2016',
              },
            },
          },
        ],
      },
    ],
  },
  externals: [
    function ({ request }, callback) {
      if (
        [
          'node-pty',
          'oniguruma',
          '@parcel/watcher',
          'nsfw',
          'spdlog',
          'vm2',
          'canvas',
          '@opensumi/vscode-ripgrep',
          'vertx',
          'keytar',
          'tsconfig-paths',
        ].indexOf(request) !== -1
      ) {
        return callback(null, `commonjs ${request}`);
      }
      callback();
    },
  ],
  resolveLoader: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    mainFields: ['loader', 'main'],
    modules: [
      path.join(__dirname, '../../../node_modules'),
      path.join(__dirname, '../node_modules'),
      path.resolve('node_modules'),
    ],
  },
  plugins: [!process.env.CI && new webpack.ProgressPlugin()],
});
