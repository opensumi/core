import paths from 'path';

import fs from 'fs-extra';
import uniqBy from 'lodash/uniqBy';

import { FileChangeType, isLinux, parseGlob } from '@opensumi/ide-core-common';

import { INsfw } from '../../../common';
import { shouldIgnorePath } from '../../shared';

import { DriverFileChange } from './base';

function requireNSFWModule(): typeof import('nsfw') {
  return require('nsfw');
}

export const watchByNSFW = async (
  realPath: string,
  options: {
    onError: (err: Error) => void;
    onEvents: (events: DriverFileChange[]) => void;
    // todo: support dynamic excludes
    excludes?: string[];
  },
) => {
  const nsfw = requireNSFWModule();

  const excludesFn = compileExcludePattern(options.excludes);

  const watcher: INsfw.NSFW = await nsfw(
    realPath,
    async (events: INsfw.ChangeEvent[]) => {
      if (events.length > 5000) {
        return;
      }

      const filterEvents = events.filter((event) => {
        // 如果是 RENAME，不会产生临时文件
        if (event.action === INsfw.actions.RENAMED) {
          return true;
        }

        return !shouldIgnorePath(event.file);
      });

      const mergedEvents = uniqBy(filterEvents, (event) => {
        if (event.action === INsfw.actions.RENAMED) {
          const deletedPath = paths.join(event.directory, event.oldFile!);
          const newPath = paths.join(event.newDirectory || event.directory, event.newFile!);
          return deletedPath + newPath;
        }

        return event.action + paths.join(event.directory, event.file!);
      });

      const result = [] as DriverFileChange[];

      await Promise.all(
        mergedEvents.map(async (event) => {
          switch (event.action) {
            case INsfw.actions.RENAMED:
              {
                const deletedPath = await resolvePath(event.directory, event.oldFile!);
                if (excludesFn(deletedPath)) {
                  return;
                }

                result.push({ path: deletedPath, type: FileChangeType.DELETED });

                if (event.newDirectory) {
                  const path = await resolvePath(event.newDirectory, event.newFile!);
                  if (excludesFn(path)) {
                    return;
                  }

                  result.push({ path, type: FileChangeType.ADDED });
                } else {
                  const path = await resolvePath(event.directory, event.newFile!);
                  if (excludesFn(path)) {
                    return;
                  }

                  result.push({ path, type: FileChangeType.ADDED });
                }
              }
              break;
            default:
              {
                const path = await resolvePath(event.directory, event.file!);
                if (excludesFn(path)) {
                  return;
                }

                switch (event.action) {
                  case INsfw.actions.CREATED:
                    result.push({ path, type: FileChangeType.ADDED });
                    break;
                  case INsfw.actions.DELETED:
                    result.push({ path, type: FileChangeType.DELETED });
                    break;
                  case INsfw.actions.MODIFIED:
                    result.push({ path, type: FileChangeType.UPDATED });
                    break;
                }
              }
              break;
          }
        }),
      );
    },
    {
      errorCallback: (err) => {
        options.onError(err);
      },
    },
  );

  await watcher.start();

  return {
    dispose: async () => {
      await watcher.stop();
    },
  };
};

function compileExcludePattern(excludes?: string[]): (path: string) => boolean {
  const matches = excludes?.map((pattern) => parseGlob(pattern));
  return (path: string) => {
    if (!matches || matches.length < 1) {
      return false;
    }

    return matches.some((match) => match(path));
  };
}

async function resolvePath(directory: string, file: string): Promise<string> {
  const path = paths.join(directory, file);
  // 如果是 linux 则获取一下真实 path，以防返回的是软连路径被过滤
  if (isLinux) {
    try {
      return await fs.realpath.native(path);
    } catch (_e) {
      try {
        // file does not exist try to resolve directory
        return paths.join(await fs.realpath.native(directory), file);
      } catch (_e) {
        // directory does not exist fall back to symlink
        return path;
      }
    }
  }
  return path;
}
