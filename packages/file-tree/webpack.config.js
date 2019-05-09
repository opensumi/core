const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const resolveHelper = require('../../tool/webpack/resolve');

module.exports = {
  entry: __dirname + '/example/app',
  output: {
    filename: 'bundle.js',
    path: __dirname + '/dist'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    alias: resolveHelper.getAlias(),
  },
  mode: 'development',
  devtool: 'eval',
  module: {
    rules: [
      {
        test: /\.tsx?$/, loader: "ts-loader"
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: __dirname + '/example/index.html'
    }),
    new MiniCssExtractPlugin({
      filename: "[name].[chunkhash:8].css",
      chunkFilename: "[id].css"
    })
  ],
  devServer: {
    contentBase: __dirname + '/out',
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
      },
      '/socket.io': {
        target: 'http://localhost:8000',
      },
    }
  }
};
