const { createWebpackConfig } = require('@ide-framework/ide-dev-tool/src/webpack');
module.exports = createWebpackConfig(__dirname, require('path').join(__dirname, 'entry/web/app.tsx'));