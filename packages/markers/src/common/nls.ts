import nlsData = require('../package.nls.json');

export namespace nls {
  export function localize(key: string, _default: string) {
      return nlsData[key] || _default;
  }
}
