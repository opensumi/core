// tslint:disable:no-var-requires
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const path = require('path');

const tsConfigPath = path.join(__dirname, '../../../tsconfig.json');

exports.createWebpackConfig = function(dir) {
  return {
    entry: dir + '/example/app',
    output: {
      filename: 'bundle.js',
      path: dir + '/dist',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
      plugins: [new TsconfigPathsPlugin({ configFile: tsConfigPath })]
    },
    mode: 'development',
    devtool: 'eval',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          options: {
            configFile: path.join(__dirname, '../../../tsconfig.json'),
          }
        },
        { 
          test: /\.png$/, 
          use: 'file-loader',
        },  
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          test: /\.less$/,
          use: [
            {
              loader: "style-loader"
            },
            {
              loader: "css-loader",
              options: {
                sourceMap: true,
                modules: true,
                localIdentName: "[local]___[hash:base64:5]"
              }
            },
            {
              loader: "less-loader"
            }
          ]
        }
      ],
    },
    resolveLoader: {
      modules: [path.join(__dirname, '../../../node_modules'), path.join(__dirname, '../node_modules'), path.resolve('node_modules')],
      extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
      mainFields: ['loader', 'main'],
      moduleExtensions: ['-loader'],
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
