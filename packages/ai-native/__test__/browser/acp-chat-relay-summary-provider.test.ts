import { ChatMessageRole } from '@opensumi/ide-core-common/lib/types/ai-native';

import { AcpChatRelaySummaryProvider } from '../../src/browser/acp/acp-chat-relay-summary-provider';

function createSession(options: {
  memorySummaries?: Array<{ content: string; timestamp: number; messageIds: string[] }>;
  messages?: Array<{ role: ChatMessageRole; content: string; id?: string; order?: number }>;
}) {
  return {
    sessionId: 'acp:source',
    title: 'Source Session',
    history: {
      getMemorySummaries: jest.fn().mockReturnValue(options.memorySummaries ?? []),
      getMessages: jest.fn().mockReturnValue(
        (options.messages ?? []).map((message, index) => ({
          id: message.id ?? `msg-${index}`,
          order: message.order ?? index,
          role: message.role,
          content: message.content,
        })),
      ),
    },
  };
}

function createProvider(request = jest.fn()) {
  const provider = new AcpChatRelaySummaryProvider();
  Object.defineProperty(provider, 'aiBackService', {
    value: { request },
  });
  Object.defineProperty(provider, 'configProvider', {
    value: {
      resolveConfig: jest.fn().mockResolvedValue({
        agentId: 'claude-agent-acp',
        command: 'claude-agent-acp',
        args: [],
        cwd: '/workspace',
      }),
    },
  });
  return provider;
}

describe('AcpChatRelaySummaryProvider', () => {
  it('uses existing memory summaries before calling the model', async () => {
    const request = jest.fn();
    const provider = createProvider(request);
    const session = createSession({
      memorySummaries: [
        { content: JSON.stringify({ memory: 'Earlier work was completed.' }), timestamp: 2, messageIds: ['2'] },
        { content: 'Initial investigation found a terminal issue.', timestamp: 1, messageIds: ['1'] },
      ],
    });

    const result = await provider.prepareSessionDigest(session, { maxDigestChars: 1000 });

    expect(result).toMatchObject({
      digestSource: 'memory_summary',
      digest: 'Initial investigation found a terminal issue.\n\nEarlier work was completed.',
      sourceTruncated: false,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('builds bounded source material and asks the model for a background summary', async () => {
    const request = jest.fn().mockResolvedValue({
      errorCode: 0,
      data: '会话主要完成了终端能力验证，下一步需要补充权限确认。',
    });
    const provider = createProvider(request);
    const session = createSession({
      messages: [
        { role: ChatMessageRole.User, content: '帮我验证 terminal_create' },
        { role: ChatMessageRole.Assistant, content: '已验证 terminal_create 可以创建终端。' },
        { role: ChatMessageRole.Function, content: 'large tool result should be ignored' },
      ],
    });

    const result = await provider.prepareSessionDigest(session, { maxSourceChars: 1000, maxDigestChars: 1000 });

    expect(result).toMatchObject({
      digestSource: 'background_summary',
      digest: '会话主要完成了终端能力验证，下一步需要补充权限确认。',
      sourceChars: expect.any(Number),
    });
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('Summarize this ACP chat session'),
      expect.objectContaining({
        type: 'acp_chat_relay_summary',
        sessionId: 'acp:source',
        noTool: true,
        agentSessionConfig: expect.objectContaining({
          agentId: 'claude-agent-acp',
          cwd: '/workspace',
        }),
        messages: [
          { role: ChatMessageRole.User, content: '帮我验证 terminal_create' },
          { role: ChatMessageRole.Assistant, content: '已验证 terminal_create 可以创建终端。' },
        ],
      }),
    );
  });

  it('returns an empty digest when the background summary request fails', async () => {
    const request = jest.fn().mockResolvedValue({
      errorCode: -1,
      errorMsg: 'request is not supported',
    });
    const provider = createProvider(request);
    const session = createSession({
      messages: [{ role: ChatMessageRole.User, content: '同步一下进展' }],
    });

    const result = await provider.prepareSessionDigest(session);

    expect(result).toMatchObject({
      digestSource: 'empty',
      digest: '',
      digestChars: 0,
    });
  });
});
