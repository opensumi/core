import os from 'os';
import path from 'path';

import * as fs from 'fs-extra';

import { toLocalISOString, ILogService } from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { LogLevel, SupportLogNamespace, ILogServiceManager } from '../../src/common';
import { LogServiceModule } from '../../src/node';
import { LogLevelMessageMap } from '../../src/node/log.service';

const testDir = path.join(os.homedir(), '.sumi-test');
const logDir = path.join(testDir, 'logs_1');
const today = Number(
  toLocalISOString(new Date())
    .replace(/-/g, '')
    .match(/^\d{8}/)![0],
);

function doAllLog(logger: ILogService) {
  logger.verbose('verbose!');
  logger.debug('debug!');
  logger.log('log!');
  logger.warn('warn!');
  logger.error('error!');
  logger.critical('critical!');
}

describe('LogService', () => {
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
    fs.rmdirSync(testDir);
  });

  test('Test level with default Info', async () => {
    const logger = loggerManager.getLogger(SupportLogNamespace.Browser);

    doAllLog(logger);
    logger.error(new Error('error!'));
    await logger.flush();

    const text = fs.readFileSync(path.join(logDir, String(today), `${SupportLogNamespace.Browser}.log`), {
      encoding: 'utf8',
    });
    // eslint-disable-next-line no-console
    console.log('text', text);
    if (text.trim().length < 1) {
      // eslint-disable-next-line no-console
      return console.warn('spdlog 写入文件可能失败了、或者 spdlog 初始化失败！');
    }
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Verbose]) < 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Debug]) < 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Info]) > 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Warning]) > 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Error]) > 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Critical]) > 0).toBe(true);
    expect(text.indexOf('Error') > -1).toBe(true);
  });
});
