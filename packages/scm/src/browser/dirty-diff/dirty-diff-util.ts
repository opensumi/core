import { IChange } from '@ide-framework/ide-core-common';

export function compareChanges(a: IChange, b: IChange): number {
  let result = a.modifiedStartLineNumber - b.modifiedStartLineNumber;

  if (result !== 0) {
    return result;
  }

  result = a.modifiedEndLineNumber - b.modifiedEndLineNumber;

  if (result !== 0) {
    return result;
  }

  result = a.originalStartLineNumber - b.originalStartLineNumber;

  if (result !== 0) {
    return result;
  }

  return a.originalEndLineNumber - b.originalEndLineNumber;
}

export function getModifiedEndLineNumber(change: IChange): number {
  if (change.modifiedEndLineNumber === 0) {
    return change.modifiedStartLineNumber === 0 ? 1 : change.modifiedStartLineNumber;
  } else {
    return change.modifiedEndLineNumber;
  }
}
