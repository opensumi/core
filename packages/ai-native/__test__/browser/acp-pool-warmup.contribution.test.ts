jest.mock('tiktoken', () => ({
  Tiktoken: jest.fn(),
  get_encoding: jest.fn(),
}));

import { AINativeBrowserContribution } from '../../src/browser/ai-core.contribution';

describe('AINativeBrowserContribution ACP pool warmup', () => {
  function createContribution(options: { resolvePrewarmConfig?: jest.Mock; warmUpAgentPool?: jest.Mock }): {
    contribution: AINativeBrowserContribution;
    logger: { warn: jest.Mock };
  } {
    const contribution = Object.create(AINativeBrowserContribution.prototype) as AINativeBrowserContribution;
    const logger = { warn: jest.fn() };
    Object.defineProperties(contribution, {
      aiBackService: {
        configurable: true,
        value: { warmUpAgentPool: options.warmUpAgentPool },
      },
      acpConfigProvider: {
        configurable: true,
        value: { resolvePrewarmConfig: options.resolvePrewarmConfig },
      },
      logger: {
        configurable: true,
        value: logger,
      },
    });
    return { contribution, logger };
  }

  it('warms the configured default ACP pool without awaiting the background task', async () => {
    const config = { agentId: 'agent', command: 'agent', args: [], cwd: '/workspace', env: [] };
    const resolvePrewarmConfig = jest.fn().mockResolvedValue(config);
    const warmUpAgentPool = jest.fn().mockResolvedValue(undefined);
    const { contribution } = createContribution({ resolvePrewarmConfig, warmUpAgentPool });

    (contribution as any).warmUpDefaultAcpPool();
    await new Promise((resolve) => setImmediate(resolve));

    expect(resolvePrewarmConfig).toHaveBeenCalledTimes(1);
    expect(warmUpAgentPool).toHaveBeenCalledWith(config);
  });

  it('does nothing when the config provider has no safe startup cwd', async () => {
    const resolvePrewarmConfig = jest.fn().mockResolvedValue(undefined);
    const warmUpAgentPool = jest.fn();
    const { contribution } = createContribution({ resolvePrewarmConfig, warmUpAgentPool });

    (contribution as any).warmUpDefaultAcpPool();
    await new Promise((resolve) => setImmediate(resolve));

    expect(warmUpAgentPool).not.toHaveBeenCalled();
  });

  it('logs background warmup failures without surfacing them to startup', async () => {
    const resolvePrewarmConfig = jest.fn().mockRejectedValue(new Error('config unavailable'));
    const { contribution, logger } = createContribution({ resolvePrewarmConfig, warmUpAgentPool: jest.fn() });

    (contribution as any).warmUpDefaultAcpPool();
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.warn).toHaveBeenCalledWith('[AINative] Failed to resolve ACP pool warmup config', expect.any(Error));
  });
});
