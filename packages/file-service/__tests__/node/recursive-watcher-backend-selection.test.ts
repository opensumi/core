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
    writeFile: jest.fn(),
    pathExists: jest.fn(),
    realpath: jest.fn(),
    lstat: jest.fn(),
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

jest.mock('nsfw', () => jest.fn());

import ParcelWatcher from '@parcel/watcher';
import fs from 'fs-extra';

import { RecursiveWatcherBackend } from '../../src/common';
import { RecursiveFileSystemWatcher } from '../../src/node/hosted/recursive/file-service-watcher';

const mkdtempMock = fs.mkdtemp as unknown as jest.Mock;
const removeMock = fs.remove as unknown as jest.Mock;
const writeFileMock = fs.writeFile as unknown as jest.Mock;
const pathExistsMock = fs.pathExists as unknown as jest.Mock;
const realpathMock = fs.realpath as unknown as jest.Mock;
const lstatMock = fs.lstat as unknown as jest.Mock;
const subscribeMock = ParcelWatcher.subscribe as unknown as jest.Mock;

const createLogger = () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('RecursiveFileSystemWatcher backend selection on linux', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mkdtempMock.mockReset();
    removeMock.mockReset();
    writeFileMock.mockReset();
    subscribeMock.mockReset();
    pathExistsMock.mockReset();
    realpathMock.mockReset();
    lstatMock.mockReset();
  });

  describe('detectParcelWatcherAvailabilityOnLinux', () => {
    it('returns true when parcel watcher receives file events', async () => {
      const tempDir = '/tmp/opensumi-parcel-watch-test';
      const testFile = `${tempDir}/probe-test-file`;

      mkdtempMock.mockResolvedValue(tempDir);
      removeMock.mockResolvedValue(undefined);
      writeFileMock.mockResolvedValue(undefined);

      // Mock subscribe to trigger callback with the test file event
      subscribeMock.mockImplementation((dir, callback) => {
        // Simulate receiving the file create event after a short delay
        setTimeout(() => {
          callback(null, [{ type: 'create', path: testFile }]);
        }, 50);
        return Promise.resolve({ unsubscribe: jest.fn().mockResolvedValue(undefined) });
      });

      const logger = createLogger();
      const watcher = new RecursiveFileSystemWatcher([], logger as any, RecursiveWatcherBackend.NSFW);

      const shouldFallback = await watcher['shouldUseNSFW']();

      expect(shouldFallback).toBe(false);
      expect(subscribeMock).toHaveBeenCalledTimes(1);
      expect(writeFileMock).toHaveBeenCalledWith(testFile, 'probe');
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('parcel/watcher backend verified working on linux'),
      );

      // Cached result avoids re-running the probe
      subscribeMock.mockClear();
      await watcher['shouldUseNSFW']();
      expect(subscribeMock).not.toHaveBeenCalled();

      watcher.dispose();
    });

    it('returns false (fallback to nsfw) when parcel watcher does not receive events within timeout', async () => {
      const tempDir = '/tmp/opensumi-parcel-watch-test2';

      mkdtempMock.mockResolvedValue(tempDir);
      removeMock.mockResolvedValue(undefined);
      writeFileMock.mockResolvedValue(undefined);

      // Mock subscribe but never trigger the callback (simulates no events received)
      subscribeMock.mockImplementation(() => Promise.resolve({ unsubscribe: jest.fn().mockResolvedValue(undefined) }));

      const logger = createLogger();
      const watcher = new RecursiveFileSystemWatcher([], logger as any, RecursiveWatcherBackend.NSFW);

      // Directly test the detection method - it will timeout after 3 seconds
      const detectResult = await watcher['detectParcelWatcherAvailabilityOnLinux']();

      // Since no events are triggered, it should timeout and return false
      expect(detectResult).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('did not receive events on linux within timeout'),
      );
      expect(removeMock).toHaveBeenCalledWith(tempDir);

      watcher.dispose();
    }, 10000);

    it('returns false when parcel subscribe fails', async () => {
      const tempDir = '/tmp/opensumi-parcel-watch-test3';

      mkdtempMock.mockResolvedValue(tempDir);
      removeMock.mockResolvedValue(undefined);

      // Mock subscribe to reject
      subscribeMock.mockRejectedValue(new Error('subscribe failed'));

      const logger = createLogger();
      const watcher = new RecursiveFileSystemWatcher([], logger as any, RecursiveWatcherBackend.NSFW);

      const shouldFallback = await watcher['shouldUseNSFW']();

      expect(shouldFallback).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
      expect(removeMock).toHaveBeenCalledTimes(1);

      watcher.dispose();
    });

    it('cleans up temp directory even when probe fails', async () => {
      const tempDir = '/tmp/opensumi-parcel-watch-test4';

      mkdtempMock.mockResolvedValue(tempDir);
      removeMock.mockResolvedValue(undefined);
      subscribeMock.mockRejectedValue(new Error('probe error'));

      const watcher = new RecursiveFileSystemWatcher([], createLogger() as any, RecursiveWatcherBackend.NSFW);

      await watcher['shouldUseNSFW']();

      expect(removeMock).toHaveBeenCalledWith(tempDir);

      watcher.dispose();
    });
  });

  describe('watchWithParcel fallback on Linux', () => {
    it('throws error and notifies when parcel subscribe fails on Linux', async () => {
      const logger = createLogger();
      const watcher = new RecursiveFileSystemWatcher([], logger as any, RecursiveWatcherBackend.PARCEL);

      // Mock parcel subscribe to fail
      subscribeMock.mockRejectedValue(new Error('subscribe failed'));

      const mockClient = {
        onDidFilesChanged: jest.fn(),
        onWatcherFailed: jest.fn(),
      };
      watcher.setClient(mockClient as any);

      // Directly test watchWithParcel
      await expect(watcher['watchWithParcel']('/test/path')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
      expect(mockClient.onWatcherFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          resolvedUri: '/test/path',
          backend: RecursiveWatcherBackend.PARCEL,
        }),
      );

      watcher.dispose();
    });

    it('start method falls back to nsfw when parcel fails on Linux', async () => {
      const tempDir = '/tmp/opensumi-parcel-watch-test5';
      const testFile = `${tempDir}/probe-test-file`;

      mkdtempMock.mockResolvedValue(tempDir);
      removeMock.mockResolvedValue(undefined);
      writeFileMock.mockResolvedValue(undefined);
      pathExistsMock.mockResolvedValue(true);
      realpathMock.mockImplementation((p) => Promise.resolve(p));
      lstatMock.mockResolvedValue({ isDirectory: () => true });

      // First subscribe call is for probe - make it succeed
      // Second subscribe call is for actual watch - make it fail
      let subscribeCallCount = 0;
      subscribeMock.mockImplementation((dir, callback) => {
        subscribeCallCount++;
        if (subscribeCallCount === 1) {
          // Probe call - trigger success event
          setTimeout(() => {
            callback(null, [{ type: 'create', path: testFile }]);
          }, 50);
          return Promise.resolve({ unsubscribe: jest.fn().mockResolvedValue(undefined) });
        }
        // Actual watch call - fail
        return Promise.reject(new Error('watch failed'));
      });

      // Mock nsfw
      const nsfwMock = require('nsfw');
      const mockNsfwWatcher = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };
      nsfwMock.mockResolvedValue(mockNsfwWatcher);

      const logger = createLogger();
      const watcher = new RecursiveFileSystemWatcher([], logger as any, RecursiveWatcherBackend.NSFW);

      // This should: 1. Pass probe 2. Fail watchWithParcel 3. Fallback to nsfw
      await watcher['start']('/test/watch/path', undefined);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('falling back to nsfw'), expect.anything());
      expect(nsfwMock).toHaveBeenCalled();
      expect(mockNsfwWatcher.start).toHaveBeenCalled();

      watcher.dispose();
    });
  });

  it('skips linux probe when backend is not nsfw', async () => {
    const watcher = new RecursiveFileSystemWatcher([], createLogger() as any, RecursiveWatcherBackend.PARCEL);

    const shouldFallback = await watcher['shouldUseNSFW']();
    expect(shouldFallback).toBe(false);
    expect(subscribeMock).not.toHaveBeenCalled();

    watcher.dispose();
  });
});
