import { FileUri } from '@opensumi/ide-core-node';

import { FileChangeType } from '../../src/common';
import { FileChangeCollection } from '../../src/node/file-change-collection';

describe('FileChangeCollection', () => {
  assertChanges({
    first: FileChangeType.ADDED,
    second: FileChangeType.ADDED,
    expected: FileChangeType.ADDED,
  });

  assertChanges({
    first: FileChangeType.ADDED,
    second: FileChangeType.UPDATED,
    expected: FileChangeType.ADDED,
  });

  assertChanges({
    first: FileChangeType.ADDED,
    second: FileChangeType.DELETED,
    expected: undefined,
  });

  assertChanges({
    first: FileChangeType.UPDATED,
    second: FileChangeType.ADDED,
    expected: FileChangeType.UPDATED,
  });

  assertChanges({
    first: FileChangeType.UPDATED,
    second: FileChangeType.UPDATED,
    expected: FileChangeType.UPDATED,
  });

  assertChanges({
    first: FileChangeType.UPDATED,
    second: FileChangeType.DELETED,
    expected: FileChangeType.DELETED,
  });

  assertChanges({
    first: FileChangeType.DELETED,
    second: FileChangeType.ADDED,
    expected: FileChangeType.UPDATED,
  });

  assertChanges({
    first: FileChangeType.DELETED,
    second: FileChangeType.UPDATED,
    expected: FileChangeType.UPDATED,
  });

  assertChanges({
    first: FileChangeType.DELETED,
    second: FileChangeType.DELETED,
    expected: FileChangeType.DELETED,
  });

  function assertChanges({
    first,
    second,
    expected,
  }: {
    first: FileChangeType;
    second: FileChangeType;
    expected: FileChangeType | undefined;
  }): void {
    it(`${FileChangeType[first]} + ${FileChangeType[second]} => ${
      expected !== undefined ? FileChangeType[expected] : 'NONE'
    }`, () => {
      const collection = new FileChangeCollection();
      const uri = FileUri.create('/root/foo/bar.txt').toString();
      collection.push({
        uri,
        type: first,
      });
      collection.push({
        uri,
        type: second,
      });
      if (expected !== undefined) {
        expect([
          {
            uri,
            type: expected,
          },
        ]).toEqual(collection.values());
      } else {
        expect([]).toEqual(collection.values());
      }
    });
  }
});
