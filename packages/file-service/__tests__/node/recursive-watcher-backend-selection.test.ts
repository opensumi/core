jest.mock('@opensumi/ide-core-common/lib/utils', () => {
  const actual = jest.requireActual('@opensumi/ide-core-common/lib/utils');
  return {
    ...actual,
    isLinux: true,
    isWindows: false,
  };
});

jest.mock('fs-extra', () => {
  const actual = jest.requireActual('fs-extra');
  return {
    ...actual,
    mkdtemp: jest.fn(),
    remove: jest.fn(),
  };
});

jest.mock('@parcel/watcher', () => {
  const mock: any = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    getEventsSince: jest.fn(),
    writeSnapshot: jest.fn(),
  };
  mock.default = mock;
  return mock;
});

import ParcelWatcher from '@parcel/watcher';
import fs from 'fs-extra';

import { RecursiveWatcherBackend } from '../../src/common';
import { RecursiveFileSystemWatcher } from '../../src/node/hosted/recursive/file-service-watcher';

const mkdtempMock = fs.mkdtemp as unknown as jest.Mock;
const removeMock = fs.remove as unknown as jest.Mock;
const writeSnapshotMock = ParcelWatcher.writeSnapshot as unknown as jest.Mock;

const createLogger = () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('RecursiveFileSystemWatcher backend selection on linux', () => {
  beforeEach(() => {
    mkdtempMock.mockReset();
    removeMock.mockReset();
    writeSnapshotMock.mockReset();
  });

  it('prefers parcel watcher when linux backend probe succeeds', async () => {
    mkdtempMock.mockResolvedValue('/tmp/sumi-parcel-1');
    removeMock.mockResolvedValue(undefined);
    writeSnapshotMock.mockResolvedValue('/tmp/sumi-parcel-1/snapshot');

    const watcher = new RecursiveFileSystemWatcher([], createLogger() as any, RecursiveWatcherBackend.NSFW);

    const shouldFallback = await watcher['shouldUseNSFW']();
    expect(shouldFallback).toBe(false);
    expect(writeSnapshotMock).toHaveBeenCalledTimes(1);

    // Cached result avoids re-running the probe.
    await watcher['shouldUseNSFW']();
    expect(writeSnapshotMock).toHaveBeenCalledTimes(1);

    watcher.dispose();
  });

  it('falls back to nsfw when parcel watcher probe fails', async () => {
    mkdtempMock.mockResolvedValue('/tmp/sumi-parcel-2');
    removeMock.mockResolvedValue(undefined);
    writeSnapshotMock.mockRejectedValue(new Error('fail to init parcel'));

    const logger = createLogger();
    const watcher = new RecursiveFileSystemWatcher([], logger as any, RecursiveWatcherBackend.NSFW);

    const shouldFallback = await watcher['shouldUseNSFW']();

    expect(shouldFallback).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledTimes(1);

    watcher.dispose();
  });

  it('skips linux probe when backend is not nsfw', async () => {
    const watcher = new RecursiveFileSystemWatcher([], createLogger() as any, RecursiveWatcherBackend.PARCEL);

    const shouldFallback = await watcher['shouldUseNSFW']();
    expect(shouldFallback).toBe(false);
    expect(writeSnapshotMock).not.toHaveBeenCalled();

    watcher.dispose();
  });
});
