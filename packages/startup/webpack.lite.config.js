const { createWebpackConfig } = require('@ali/ide-dev-tool/src/webpack');
const webpack = require('webpack');

module.exports = createWebpackConfig(
  __dirname,
  require('path').join(__dirname, 'entry/web-lite/app.tsx'),
  {
    devServer: {
      proxy: {
        '/code-service': {
          target: 'https://code.alipay.com',
          changeOrigin: true,
          pathRewrite: {
            '^/code-service': '/api'
          },
          headers: {
            'private-token': process.env.ANTCODE_SK || '',
            host: 'code.alipay.com',
            origin: 'https://code.alipay.com',
          },
        },
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.SCM_PLATFORM': JSON.stringify(process.env.SCM_PLATFORM),
      }),
    ]
  },
);
