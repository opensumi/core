const path = require('path')
const fs = require('fs')

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, './package.json'), 'utf-8'))

module.exports = {
  entry: path.join(__dirname, './src/hosted/worker.host.ts'),
  node: {
    net: "empty"
  },
  output: {
    filename: 'worker-host.js',
    path: path.resolve(__dirname, 'lib/'),
    // library: `extend-browser-worker-${pkg.name}`,
    // libraryTarget: 'umd'
  },
  target: 'webworker',
  devtool: 'none',
  mode: 'none',
  optimization: {
    minimize: false
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: "ts-loader", options: {onlyCompileBundledFiles: true} }
    ]
  }
}