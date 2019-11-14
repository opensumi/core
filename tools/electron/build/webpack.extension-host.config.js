// tslint:disable:no-var-requires
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const path = require('path');

const tsConfigPath = path.join(__dirname, '../tsconfig.json');
const distDir = path.join(__dirname, '../app/dist/extension')

module.exports = {
  entry: require.resolve('@ali/ide-kaitian-extension/lib/hosted/ext.process.js'),
  target: "node",
  output: {
    filename: 'index.js',
    path: distDir,
  },
  node: false,
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [new TsconfigPathsPlugin({
      configFile: tsConfigPath,
    })]
  },
  mode: 'development',
  devtool: 'source-map',
  module: {
    // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
    exprContextCritical: false,
    rules: [{
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          configFile: tsConfigPath,
          compilerOptions: {
            target: 'es5'
          }
        }
      },
    ],
  },
  externals:[
    function(context, request, callback) {
      if (['node-pty','oniguruma','nsfw','spdlog', 'getmac'].indexOf(request) !== -1){
        return callback(null, 'commonjs ' + request);
      }
      callback();
    }
  ],
  resolveLoader: {
    modules: [path.join(__dirname, '../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
    moduleExtensions: ['-loader'],
  },
};
