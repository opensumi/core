const path = require('path');
const fs = require('fs')

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, './package.json'), 'utf-8'))

module.exports = {
  entry: path.join(__dirname, './src/extend/node/index.ts'),
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'out/node'),
    library: `extend-node-${pkg.name}`,
    libraryTarget: "commonjs2"
  },
  target: 'node',
  optimization: {
    minimize: false
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" }
    ]
  }
};