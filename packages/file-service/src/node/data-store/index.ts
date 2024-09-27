import { RefCountedDisposable } from '@opensumi/ide-core-common';

export const WatchInsData = 'WatchIns';
export interface WatchInsData {
  watcherId: number;
  path: string;

  disposable: RefCountedDisposable;
}

export const fileChangeEvent = (watcherId: number | string) => `file-changes-${watcherId}`;
