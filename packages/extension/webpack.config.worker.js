const path = require('path');

const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const { ProgressPlugin } = require('webpack');

const tsconfigPath = path.join(__dirname, '../../configs/ts/references/tsconfig.extension.json');

/** @type { import('webpack').Configuration } */
module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: path.join(__dirname, './src/hosted/worker.host-preload.ts'),
  output: {
    // disable automatic publicPath
    publicPath: '',
    filename: 'worker-host.js',
    path: path.resolve(__dirname, 'lib/'),
  },
  target: 'webworker',
  devtool: false,
  node: {
    global: true,
  },
  optimization: {
    minimize: false,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    fallback: {
      net: false,
      path: false,
      os: false,
      crypto: false,
    },
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: 'ts-loader', options: { onlyCompileBundledFiles: true, configFile: tsconfigPath } },
      // css won't be bundled
      { test: /\.css$/, loader: 'null-loader' },
    ],
  },
  plugins: [
    !process.env.CI && new ProgressPlugin(),
    new NodePolyfillPlugin({
      includeAliases: ['process', 'util', 'buffer', 'Buffer'],
    }),
  ].filter(Boolean),
};
