const path = require('path');

module.exports = {
  entry: './src/node/index.ts',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'lib/node'),
    library: "test-ide-core-extension",
    libraryTarget: "commonjs2"
  },
  devServer: {
      contentBase: './dist'
  },
  optimization: {
    minimize: false
  },
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: "ts-loader" }
    ]
  },
  externals: ['kaitian', 'kaitian-node']
};