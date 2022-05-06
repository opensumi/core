// 关于 resolver 的文档请看: https://jestjs.io/docs/configuration#resolver-string

module.exports = (path, options) =>
  // Call the defaultResolver, so we leverage its cache, error handling, etc.
  options.defaultResolver(path, {
    ...options,
    // Use packageFilter to process parsed `package.json` before the resolution (see https://www.npmjs.com/package/resolve#resolveid-opts-cb)
    packageFilter: (pkg) => {
      if (pkg.name === 'nanoid') {
        // 一个对于 jest@28 的 workaround，具体原因请见：https://github.com/microsoft/accessibility-insights-web/pull/5421/commits/9ad4e618019298d82732d49d00aafb846fb6bac7
        delete pkg['exports'];
        delete pkg['module'];
      }
      return pkg;
    },
  });
