import { localize as _localize } from '@ali/ide-core-browser';

export namespace nls {
  export function localize(key: string, _default: string) {
    return _localize(key, _default);
  }
}
