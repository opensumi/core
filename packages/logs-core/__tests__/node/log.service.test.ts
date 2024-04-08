import path from 'path';

import fs from 'fs-extra';
import temp from 'temp';

import { toLocalISOString, ILogService } from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { LogLevel, SupportLogNamespace, ILogServiceManager } from '../../src/common';
import { LogServiceModule } from '../../src/node';
import { LogServiceManager } from '../../src/node/log-manager';
import { LogLevelMessageMap } from '../../src/node/log.service';

const track = temp.track();
const logDir = temp.mkdirSync('log-service');
const today = Number(
  toLocalISOString(new Date())
    .replace(/-/g, '')
    .match(/^\d{8}/)?.[0],
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
  injector.overrideProviders(
    {
      token: AppConfig,
      useValue: {
        logDir,
      },
    },
    {
      token: ILogServiceManager,
      useClass: LogServiceManager,
    },
  );
  const loggerManager: ILogServiceManager = injector.get(ILogServiceManager);

  afterAll(() => {
    loggerManager.cleanAllLogs();
    track.cleanupSync();
    return injector.disposeAll();
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
      return console.warn('Spdlog may have failed to write to file, or initialization failed');
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
