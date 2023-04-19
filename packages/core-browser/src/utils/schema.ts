import type { Ajv } from 'ajv';

let _ajv;
export const acquireAjv = (): Ajv | undefined => {
  if (!_ajv) {
    const Ajv = require('ajv');
    _ajv = new Ajv();
    return _ajv;
  }
  return _ajv;
};
