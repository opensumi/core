const path = require('path');

const tsconfigPath = path.join(__dirname, '../../configs/ts/references/tsconfig.extension.json');

module.exports = {
  entry: {
    'ext.process': path.join(__dirname, './src/hosted/ext.process.ts'),
  },
  output: {
    filename: 'ext.process.js',
    path: path.resolve(__dirname, 'hosted/'),
    libraryTarget: 'commonjs2',
  },
  target: 'node',
  devtool: 'source-map',
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
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          onlyCompileBundledFiles: true,
          configFile: tsconfigPath,
          compilerOptions: {
            lib: ['esnext'],
            target: 'es6',
          },
        },
      },
      { test: /\.css$/, loader: 'null-loader' },
    ],
  },
  externals: [
    function (context, request, callback) {
      if (['node-pty', '@parcel/watcher', 'spdlog', 'electron'].indexOf(request) !== -1) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    },
  ],
};
