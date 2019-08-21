import * as os from 'os';
import * as path from 'path';
import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { AppConfig } from '@ali/ide-core-node';
import { LogServiceModule } from '../../src/node/';
import { LogLevel, SupportLogNamespace, ILogServiceManage } from '../../src/common/';

describe('Log level', () => {
  const injector = createNodeInjector([LogServiceModule]);
  injector.addProviders({
    token: AppConfig,
    useValue: {},
  });
  const LoggerManage = injector.get(ILogServiceManage);
  const { setGlobalLogLevel, getGlobalLogLevel, getLogger, init } = LoggerManage;
  init({
    logDir: path.join(os.homedir(), `.kaitian-test/logs`),
  });
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
