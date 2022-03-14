import os from 'os';
import path from 'path';

import * as fs from 'fs-extra';

import { toLocalISOString } from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { LogLevel, SupportLogNamespace, ILogServiceManager } from '../../src/common';
import { LogServiceModule } from '../../src/node';

const ktDir = path.join(os.homedir(), '.sumi-test');
const logDir = path.join(ktDir, 'logs_0');
const today = Number(
  toLocalISOString(new Date())
    .replace(/-/g, '')
    .match(/^\d{8}/)![0],
);

describe('LogServiceManager', () => {
  const injector = createNodeInjector([LogServiceModule]);
  injector.addProviders({
    token: AppConfig,
    useValue: {
      logDir,
    },
  });
  const loggerManager: ILogServiceManager = injector.get(ILogServiceManager);

  afterAll(() => {
    loggerManager.cleanAllLogs();
    fs.removeSync(ktDir);
  });
  loggerManager.setGlobalLogLevel(LogLevel.Error);

  const logger = loggerManager.getLogger(SupportLogNamespace.Node);

  logger.error('Start test!');
  ['20190801', '20190802', '20190803', '20190804', '20190805'].forEach((day) => {
    try {
      fs.mkdirpSync(path.join(logDir, day));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  });

  test('Set 、get LogLevel', () => {
    expect(logger.getLevel()).toBe(LogLevel.Error);
  });

  test('GetLogZipArchiveByDay', async () => {
    const archive = await loggerManager.getLogZipArchiveByDay(today);

    expect(archive.pipe).toBeInstanceOf(Function);
  });

  test('Clean log folder cleanOldLogs', () => {
    loggerManager.cleanOldLogs();

    const children = fs.readdirSync(logDir);
    expect(children.length).toBe(5);
    expect(children.some((child) => child === '20190801')).toBe(false);
  });

  test('Clean log folder cleanExpiredLogs', () => {
    loggerManager.cleanExpiredLogs(today);

    const children = fs.readdirSync(logDir);
    expect(children.length).toBe(1);
    expect(children[0]).toBe(String(today));
  });
});
