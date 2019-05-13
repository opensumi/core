// tslint:disable:no-var-requires
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

exports.createWebpackConfig = function(dir) {
  return {
    entry: dir + '/example/app',
    output: {
      filename: 'bundle.js',
      path: dir + '/dist',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    mode: 'development',
    devtool: 'eval',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
        },
        { 
          test: /\.png$/, 
          use: 'file-loader',
        },  
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: __dirname + '/index.html',
      }),
      new MiniCssExtractPlugin({
        filename: '[name].[chunkhash:8].css',
        chunkFilename: '[id].css',
      }),
    ],
    devServer: {
      contentBase: dir + '/out',
      port: 8080,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
        },
        '/socket.io': {
          ws: true,
          target: 'ws://localhost:8000',
        },
      },
    },
  };
}
