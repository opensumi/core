import { ILogServiceManager, LogLevel } from '@opensumi/ide-core-common';
import { INodeLogger, NodeLogger } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('NodeLogger', () => {
  let logger: INodeLogger;
  let injector: MockInjector;

  const mockLogServiceManager = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    critical: jest.fn(),
    dispose: jest.fn(),
    setOptions: jest.fn(),
    sendLog: jest.fn(),
    drop: jest.fn(),
    flush: jest.fn(),
    getLevel: jest.fn(),
    setLevel: jest.fn(),
  };

  beforeAll(() => {
    injector = createNodeInjector([]);

    injector.overrideProviders(
      ...[
        {
          token: ILogServiceManager,
          useValue: {
            getLogger: () => mockLogServiceManager,
          },
        },
        {
          token: INodeLogger,
          useClass: NodeLogger,
        },
      ],
    );
    logger = injector.get(INodeLogger);
  });

  afterAll(async () => {
    const keys = Object.keys(mockLogServiceManager);
    for (const key of keys) {
      mockLogServiceManager[key]?.mockReset();
    }
    await injector.disposeAll();
  });

  test('error', () => {
    const message = 'hello';
    logger.error(message);
    expect(mockLogServiceManager.error).toHaveBeenCalledWith(message);
  });

  test('log', () => {
    const message = 'hello';
    logger.log(message);
    expect(mockLogServiceManager.log).toHaveBeenCalledWith(message);
  });

  test('warn', () => {
    const message = 'hello';
    logger.warn(message);
    expect(mockLogServiceManager.warn).toHaveBeenCalledWith(message);
  });

  test('debug', () => {
    const message = 'hello';
    logger.debug(message);
    expect(mockLogServiceManager.debug).toHaveBeenCalledWith(message);
  });

  test('verbose', () => {
    const message = 'hello';
    logger.verbose(message);
    expect(mockLogServiceManager.verbose).toHaveBeenCalledWith(message);
  });

  test('critical', () => {
    const message = 'hello';
    logger.critical(message);
    expect(mockLogServiceManager.critical).toHaveBeenCalledWith(message);
  });

  test('dispose', () => {
    logger.dispose();
    expect(mockLogServiceManager.dispose).toHaveBeenCalledWith();
  });

  test('setOptions', () => {
    const options = {
      namespace: 'node',
      logLevel: LogLevel.Error,
    };
    logger.setOptions(options);
    expect(mockLogServiceManager.setOptions).toHaveBeenCalledWith(options);
  });

  test('sendLog', () => {
    const message = 'hello';
    logger.sendLog(LogLevel.Error, message);
    expect(mockLogServiceManager.sendLog).toHaveBeenCalledWith(LogLevel.Error, message);
  });

  test('drop', () => {
    logger.drop();
    expect(mockLogServiceManager.drop).toHaveBeenCalled();
  });

  test('flush', () => {
    logger.flush();
    expect(mockLogServiceManager.flush).toHaveBeenCalled();
  });

  test('getLevel', () => {
    logger.getLevel();
    expect(mockLogServiceManager.getLevel).toHaveBeenCalled();
  });

  test('setLevel', () => {
    logger.setLevel(LogLevel.Error);
    expect(mockLogServiceManager.setLevel).toHaveBeenCalledWith(LogLevel.Error);
  });
});
