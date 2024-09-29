import { RefCountedDisposable } from '@opensumi/ide-core-common';

export const WatchInsData = 'WatchIns';
export interface WatchInsData {
  watcherId: number;
  path: string;

  disposable: RefCountedDisposable;
}
