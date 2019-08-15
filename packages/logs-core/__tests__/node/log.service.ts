import { LoggerManage } from '../../src/node/';
import { LogLevel, SupportLogNamespace } from '../../src/common/';

const { setGlobalLogLevel, getGlobalLogLevel, getLogger, cleanOldLogs } = LoggerManage;

describe('Log level', () => {
  test('setLogLevel', () => {
    setGlobalLogLevel(LogLevel.Error);
    expect(getGlobalLogLevel()).toBe(LogLevel.Error);
  });
});

describe('Get logger', () => {
  const logger = getLogger(SupportLogNamespace.Node);

  test('Set logs', async () => {
    logger.debug('debug!!!');
    logger.log('info!!!');
    logger.error('error!!!');
    logger.warn('warn!!!');
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 3000);
    });
  });
});
