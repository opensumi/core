const path = require('path');

const tsconfigPath = path.join(__dirname, '../../configs/ts/references/tsconfig.extension.json');

module.exports = {
  entry: path.join(__dirname, './src/hosted/worker.host-preload.ts'),
  node: {
    net: 'empty',
  },
  output: {
    filename: 'worker-host.js',
    path: path.resolve(__dirname, 'lib/'),
  },
  target: 'webworker',
  devtool: 'none',
  mode: 'none',
  optimization: {
    minimize: false,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: 'ts-loader', options: { onlyCompileBundledFiles: true, configFile: tsconfigPath } },
      // css won't be bundled
      { test: /\.css$/, loader: 'null-loader' },
    ],
  },
};
