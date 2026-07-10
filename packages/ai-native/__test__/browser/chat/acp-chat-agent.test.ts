import { AINativeSettingSectionsId, CancellationToken, IChatProgress } from '@opensumi/ide-core-common';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { AcpChatAgent } from '../../../src/browser/chat/acp-chat-agent';

describe('AcpChatAgent', () => {
  function createAgent() {
    const output = new SumiReadableStream<IChatProgress>();
    const requestStream = jest.fn(async () => {
      queueMicrotask(() => output.end());
      return output;
    });
    const preferenceGet = jest.fn((id: string, fallback?: unknown) => fallback);
    const agent = Object.create(AcpChatAgent.prototype) as AcpChatAgent;

    Object.defineProperties(agent, {
      aiBackService: {
        value: { requestStream },
      },
      preferenceService: {
        value: { get: preferenceGet },
      },
      applicationService: {
        value: { clientId: 'test-client' },
      },
      chatAgentService: {
        value: { getAgent: jest.fn(() => ({ metadata: { systemPrompt: 'test system prompt' } })) },
      },
      mcpConfigService: {
        value: { getDisabledTools: jest.fn(async () => []) },
      },
      configProvider: {
        value: {
          resolveConfig: jest.fn(async () => ({
            agentId: 'test-agent',
            command: 'test-agent',
            args: [],
            cwd: '/workspace',
          })),
        },
      },
      chatFeatureRegistry: {
        value: { getSlashCommandHandler: jest.fn() },
      },
      monacoCommandRegistry: {
        value: { getActiveCodeEditor: jest.fn() },
      },
      messageService: {
        value: { error: jest.fn() },
      },
      aiReporter: {
        value: { end: jest.fn() },
      },
      logger: {
        value: { log: jest.fn(), error: jest.fn() },
      },
      chatManagerService: {
        value: { getSession: jest.fn() },
      },
    });

    return { agent, preferenceGet, requestStream };
  }

  it('uses stream as the ACP delivery mode when the preference is unset', async () => {
    const { agent, preferenceGet, requestStream } = createAgent();

    await agent.invoke(
      {
        requestId: 'request-1',
        sessionId: 'acp:session-1',
        message: 'hello',
      } as any,
      jest.fn(),
      [{ role: 'user', content: 'hello' }],
      CancellationToken.None,
    );

    expect(preferenceGet).toHaveBeenCalledWith(AINativeSettingSectionsId.AcpDeliveryMode, 'stream');
    expect(requestStream).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        acpDeliveryMode: 'stream',
        sessionId: 'session-1',
      }),
      CancellationToken.None,
    );
  });
});
