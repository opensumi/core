import { Disposable } from '@opensumi/ide-core-common';

export const MockEnvironmentVariableService = {
  set: () => {},
  delete: () => {},
  mergedCollection: undefined,
  onDidChangeCollections: () => Disposable.NULL,
};
