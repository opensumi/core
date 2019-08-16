import { LoggerManage } from '../../src/node/';
import { LogLevel, SupportLogNamespace } from '../../src/common/';

const { setGlobalLogLevel, getGlobalLogLevel, getLogger } = LoggerManage;

describe('Log level', () => {
  test('setLogLevel', () => {
    setGlobalLogLevel(LogLevel.Error);

    const logger = getLogger(SupportLogNamespace.Node);
    logger.debug('debug!!!');
    logger.log('info!!!');
    logger.warn('warn!!!');
    logger.error('error!!!');

    expect(getGlobalLogLevel()).toBe(LogLevel.Error);
  });
});
