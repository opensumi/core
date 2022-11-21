const { nanoid } = require('nanoid');

export function uuid(): string {
  return nanoid();
}
