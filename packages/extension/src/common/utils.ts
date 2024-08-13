/**
 * 对 extension-host 使用 webpack bundle 后，require 方法会被覆盖为 webpack 内部的 require
 * 这里是一个 webpack 提供的 workaround，用于获取原始的 require
 */
declare let __webpack_require__: any;
declare let __non_webpack_require__: any;

// https://github.com/webpack/webpack/issues/4175#issuecomment-342931035
export function getNodeRequire() {
  return typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
}
