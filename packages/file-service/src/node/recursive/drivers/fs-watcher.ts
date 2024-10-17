import fs, { watch } from 'fs-extra';

import { DriverFileChange } from './base';

export async function watchByFSWatcher(
  realPath: string,
  options: {
    onError: (err: Error) => void;
    onEvents: (events: DriverFileChange[]) => void;
    excludes?: string[];
    recursive?: boolean;
  },
) {
  const watcher = watch(realPath, { recursive: options?.recursive });

  watcher.on('error', (code: number, signal: string) => {
    watcher.close();

    options.onError(new Error(`Failed to watch ${realPath} for changes using fs.watch() (${code}, ${signal})`));
  });

  const stat = await fs.lstat(realPath);
  const isDirectory = stat.isDirectory();
  if (isDirectory) {
  }
}
