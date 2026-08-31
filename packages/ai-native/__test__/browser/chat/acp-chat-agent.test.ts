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
    const getSlashCommandHandler = jest.fn();
    const resolveConfigForTarget = jest.fn(async (target) => ({ ...target }));
    const getSession = jest.fn();
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
          resolveConfigForTarget,
        },
      },
      chatFeatureRegistry: {
        value: { getSlashCommandHandler },
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
        value: { getSession },
      },
    });

    return {
      agent,
      preferenceGet,
      requestStream,
      getSlashCommandHandler,
      resolveConfigForTarget,
      getSession,
    };
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

  it('accepts a custom slash command request before invoking its handler', async () => {
    const { agent, requestStream, getSlashCommandHandler } = createAgent();
    const events: string[] = [];
    const invoke = jest.fn(async () => {
      events.push('handler');
    });
    getSlashCommandHandler.mockReturnValue({ invoke });

    await agent.invoke(
      {
        requestId: 'request-slash-1',
        sessionId: 'acp:session-slash-1',
        message: 'run it',
        command: 'custom',
      } as any,
      (progress) => {
        events.push(progress.kind);
      },
      [{ role: 'user', content: 'run it' }],
      CancellationToken.None,
    );

    expect(events).toEqual(['requestAccepted', 'handler']);
    expect(invoke).toHaveBeenCalledWith('run it', expect.any(Function), CancellationToken.None);
    expect(requestStream).not.toHaveBeenCalled();
  });

  it('routes the first request through the ACP target retained by the session model', async () => {
    const { agent, resolveConfigForTarget, getSession } = createAgent();
    const acpTarget = { agentId: 'agent-b', cwd: '/work/b' };
    getSession.mockReturnValue({ acpTarget });

    await agent.invoke(
      {
        requestId: 'request-target-1',
        sessionId: 'acp:targeted-session',
        message: 'continue',
      } as any,
      jest.fn(),
      [{ role: 'user', content: 'continue' }],
      CancellationToken.None,
    );

    expect(getSession).toHaveBeenCalledWith('acp:targeted-session');
    expect(resolveConfigForTarget).toHaveBeenCalledWith(acpTarget);
  });
});
