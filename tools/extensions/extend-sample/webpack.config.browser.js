const path = require('path')
const fs = require('fs')

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, './package.json'), 'utf-8'))

module.exports = {
  entry: path.join(__dirname, './src/extend/browser/index.ts'),
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'out/browser'),
    library: `extend-browser-${pkg.name}`,
    libraryTarget: 'umd'
  },
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
    "react": "React",
    "react-dom": "ReactDOM"
  }
}