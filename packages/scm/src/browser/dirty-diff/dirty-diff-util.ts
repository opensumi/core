import { ILineChange } from '@opensumi/ide-core-common';

export function compareChanges(a: ILineChange, b: ILineChange): number {
  let result = a[2] - b[2];

  if (result !== 0) {
    return result;
  }

  result = a[3] - b[3];

  if (result !== 0) {
    return result;
  }

  result = a[0] - b[0];

  if (result !== 0) {
    return result;
  }

  return a[1] - b[1];
}

export function getModifiedEndLineNumber(change: ILineChange): number {
  if (change[3] === 0) {
    return change[2] === 0 ? 1 : change[2];
  } else {
    return change[3];
  }
}
