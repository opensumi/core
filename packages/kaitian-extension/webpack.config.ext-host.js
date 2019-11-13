const path = require("path");

const tsconfigPath = path.join(
  __dirname,
  "../../configs/ts/references/tsconfig.kaitian-extension.json"
);

module.exports = {
  entry: {
    'ext.process': path.join(__dirname, "./src/hosted/ext.process.ts"),
  },
  output: {
    filename: 'ext.process.js',
    path: path.resolve(__dirname, "lib/hosted"),
    libraryTarget: "commonjs2",
  },
  target: "node",
  devtool: "none",
  mode: "none",
  optimization: {
    minimize: false
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          onlyCompileBundledFiles: true,
          configFile: tsconfigPath,
          compilerOptions: {
            lib: ["esnext"]
          }
        }
      }
    ]
  },
  externals: [
    function(context, request, callback) {
      if (
        ["node-pty", "oniguruma", "nsfw", "spdlog", "electron"].indexOf(
          request
        ) !== -1
      ) {
        return callback(null, "commonjs " + request);
      }
      callback();
    }
  ]
};
