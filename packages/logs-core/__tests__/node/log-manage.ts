import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { AppConfig } from '@ali/ide-core-node';
import { toLocalISOString } from '@ali/ide-core-common';
import { LogServiceModule } from '../../src/node';
import { LogLevel, SupportLogNamespace, ILogServiceManage } from '../../src/common';

const ktDir = path.join(os.homedir(), `.kaitian-test`);
const logDir = path.join(ktDir, `logs_0`);
const today = Number(toLocalISOString(new Date()).replace(/-/g, '').match(/^\d{8}/)![0]);

describe('LogServiceManage', () => {
  const injector = createNodeInjector([LogServiceModule]);
  injector.addProviders({
    token: AppConfig,
    useValue: {
      logDir,
    },
  });
  const loggerManage: ILogServiceManage = injector.get(ILogServiceManage);

  afterAll(() => {
    loggerManage.cleanAllLogs();
    fs.removeSync(ktDir);
  });
  loggerManage.setGlobalLogLevel(LogLevel.Error);

  const logger = loggerManage.getLogger(SupportLogNamespace.Node);

  logger.error('Start test!');
  [
    '20190801',
    '20190802',
    '20190803',
    '20190804',
    '20190805',
  ].forEach((day) => {
    try {
      fs.mkdirpSync(path.join(logDir, day));
    } catch (e) {
      console.error(e);
    }
  });

  test('Set 、get LogLevel', () => {
    expect(logger.getLevel()).toBe(LogLevel.Error);
  });

  test('GetLogZipArchiveByDay', async () => {
    const archive = await loggerManage.getLogZipArchiveByDay(today);

    expect(archive.pipe).toBeInstanceOf(Function);
  });

  test('Clean log folder cleanOldLogs', () => {
    loggerManage.cleanOldLogs();

    const children = fs.readdirSync(logDir);
    expect(children.length).toBe(5);
    expect(children.some((child) => {
      return child === '20190801';
    })).toBe(false);
  });

  test('Clean log folder cleanExpiredLogs', () => {
    loggerManage.cleanExpiredLogs(today);

    const children = fs.readdirSync(logDir);
    expect(children.length).toBe(1);
    expect(children[0]).toBe(String(today));
  });

});
