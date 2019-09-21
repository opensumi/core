const path = require('path')
const fs = require('fs')

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, './package.json'), 'utf-8'))

const extensionId = `${pkg.publisher}.${pkg.name}`
const extensionUnderlineId = extensionId.replace(/\./g, '_').replace(/-/g, '_');

module.exports = {
  entry: path.join(__dirname, './src/extend/worker/index.ts'),
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'out/worker'),
    library: `kaitian_extend_browser_worker_${extensionUnderlineId}`,
    libraryTarget: 'var'
  },
  target: "webworker",
  optimization: {
    minimize: false
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: "ts-loader" }
    ]
  },
  externals: {
    "kaitian": `kaitian.${extensionUnderlineId}`
  }
}