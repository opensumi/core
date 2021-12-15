import * as shortid from 'shortid';

export function uuid(): string {
  return shortid.generate();
}
