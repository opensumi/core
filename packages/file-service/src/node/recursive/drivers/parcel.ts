import ParcelWatcher from '@parcel/watcher';

import { FileChangeType } from '@opensumi/ide-core-common';
import { isLinux, isWindows } from '@opensumi/ide-utils';

import { shouldIgnorePath } from '../../shared';

import { DriverFileChange } from './base';

const PARCEL_WATCHER_BACKEND = isWindows ? 'windows' : isLinux ? 'inotify' : 'fs-events';

/**
 * 过滤 `write-file-atomic` 写入生成的临时文件
 * @param events
 */
function trimChangeEvent(events: ParcelWatcher.Event[]): ParcelWatcher.Event[] {
  events = events.filter((event: ParcelWatcher.Event) => !shouldIgnorePath(event.path));
  return events;
}

export const watchByParcelWatcher = async (
  realPath: string,
  options: {
    onError: (err: Error) => void;
    onEvents: (events: DriverFileChange[]) => void;
    excludes?: string[];
  },
) => {
  const handle = await ParcelWatcher.subscribe(
    realPath,
    (err, events: ParcelWatcher.Event[]) => {
      if (err) {
        return options.onError(err);
      }

      events = trimChangeEvent(events);

      // 对于超过 5000 数量的 events 做屏蔽优化，避免潜在的卡死问题
      if (events.length > 5000) {
        // FIXME: 研究此处屏蔽的影响，考虑下阈值应该设置多少，或者更加优雅的方式
        return;
      }

      const result = [] as DriverFileChange[];
      for (const event of events) {
        switch (event.type) {
          case 'create':
            result.push({ path: event.path, type: FileChangeType.ADDED });
            break;
          case 'delete':
            result.push({ path: event.path, type: FileChangeType.DELETED });
            break;
          case 'update':
            result.push({ path: event.path, type: FileChangeType.UPDATED });
            break;
        }
      }

      options.onEvents(result);
    },
    {
      backend: PARCEL_WATCHER_BACKEND,
      ignore: options?.excludes,
    },
  );
  return {
    dispose: () => handle.unsubscribe(),
  };
};
