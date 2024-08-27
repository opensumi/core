export default {
  platform: 'browser',
  cjs: {
    output: 'lib',
  },
  extraBabelPlugins: [
    // ['babel-plugin-transform-typescript-metadata'],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-transform-flow-strip-types'],
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ['babel-plugin-parameter-decorator'],
  ],
  extraBabelPresets: [['@babel/preset-typescript']],
};
