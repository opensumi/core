exports.lessLoader = (mergeOptions = {}) => ({
  loader: require.resolve('less-loader'),
  options: {
    lessOptions: {
      javascriptEnabled: true,
    },
  },
  ...mergeOptions,
});
