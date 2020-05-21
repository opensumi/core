exports.lessLoader = (mergeOptions = {}) => ({
  loader: require.resolve('less-loader'),
  options: {
    javascriptEnabled: true,
  },
  ...mergeOptions,
});
