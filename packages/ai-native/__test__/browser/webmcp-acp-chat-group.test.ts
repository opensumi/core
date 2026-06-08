import { ChatServiceToken } from '@opensumi/ide-core-common';
import { ChatMessageRole } from '@opensumi/ide-core-common/lib/types/ai-native';

import { AcpChatRelayStore } from '../../src/browser/acp/acp-chat-relay-store';
import { AcpChatRelaySummaryProvider } from '../../src/browser/acp/acp-chat-relay-summary-provider';
import { AcpPermissionBridgeService } from '../../src/browser/acp/permission-bridge.service';
import { createAcpChatGroup } from '../../src/browser/acp/webmcp-groups/acp-chat.webmcp-group';
import { IChatInternalService } from '../../src/common';

describe('WebMCP Group - ACP Chat', () => {
  const mockSession = {
    sessionId: 'acp:sess-1',
    title: 'Current Session',
    modelId: 'claude',
    threadStatus: 'working',
    requests: [{ requestId: 'req-1' }],
    slicedMessageCount: 0,
    history: {
      getMessages: jest.fn().mockReturnValue([{ id: 'msg-1' }, { id: 'msg-2' }]),
      getMemorySummaries: jest.fn().mockReturnValue([]),
    },
  };

  const targetSession = {
    sessionId: 'acp:sess-2',
    title: 'Target Session',
    modelId: 'claude',
    threadStatus: 'awaiting_prompt',
    requests: [],
    slicedMessageCount: 0,
    history: {
      getMessages: jest.fn().mockReturnValue([]),
      getMemorySummaries: jest.fn().mockReturnValue([]),
    },
  };

  const mockChatInternalService = {
    sessionModel: mockSession,
    getSessions: jest.fn().mockReturnValue([mockSession, targetSession]),
    getAvailableCommands: jest.fn().mockReturnValue([{ name: '/explain', description: 'Explain code' }]),
    setSessionMode: jest.fn().mockResolvedValue(undefined),
    activateSession: jest.fn().mockResolvedValue(undefined),
    getSessionsByAcp: jest.fn().mockResolvedValue([mockSession, targetSession]),
    loadSessionModel: jest
      .fn()
      .mockImplementation(async (sessionId: string) => (sessionId === 'acp:sess-2' ? targetSession : mockSession)),
  };

  const mockPermissionBridge = {
    getActiveDialogCount: jest.fn().mockReturnValue(1),
    getActiveSession: jest.fn().mockReturnValue('sess-1'),
    getPendingCountExcludingActive: jest.fn().mockReturnValue(2),
    hasPendingForSession: jest.fn().mockReturnValue(true),
    showPermissionDialog: jest.fn().mockResolvedValue({ type: 'allow', optionId: 'allow_once', always: false }),
  };

  const mockChatService = {
    showChatView: jest.fn(),
    sendMessage: jest.fn(),
  };

  const mockRelaySummaryProvider = {
    prepareSessionDigest: jest.fn().mockResolvedValue({
      digestSource: 'background_summary',
      digest: 'full digest content that should stay in the relay store',
      digestChars: 54,
      sourceChars: 1200,
      sourceTruncated: false,
    }),
  };

  const mockRelayStore = {
    put: jest.fn().mockImplementation((record) => ({
      ...record,
      digestId: 'digest-1',
      createdAt: 1000,
      expiresAt: 1000 + 10 * 60 * 1000,
    })),
    get: jest.fn().mockReturnValue({
      digestId: 'digest-1',
      sourceSessionId: 'acp:sess-1',
      sourceTitle: 'Current Session',
      digestSource: 'background_summary',
      digest: 'full digest content for target session',
      digestChars: 38,
      sourceChars: 1200,
      sourceTruncated: false,
      createdAt: 1000,
      expiresAt: 1000 + 10 * 60 * 1000,
    }),
    delete: jest.fn(),
  };

  function createMockContainer() {
    return {
      get: jest.fn().mockImplementation((token) => {
        if (token === IChatInternalService) {
          return mockChatInternalService;
        }
        if (token === AcpPermissionBridgeService) {
          return mockPermissionBridge;
        }
        if (token === ChatServiceToken) {
          return mockChatService;
        }
        if (token === AcpChatRelaySummaryProvider) {
          return mockRelaySummaryProvider;
        }
        if (token === AcpChatRelayStore) {
          return mockRelayStore;
        }
        throw new Error('DI token not mocked');
      }),
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.history.getMessages.mockReturnValue([{ id: 'msg-1' }, { id: 'msg-2' }]);
    targetSession.history.getMessages.mockReturnValue([]);
    mockPermissionBridge.showPermissionDialog.mockResolvedValue({
      type: 'allow',
      optionId: 'allow_once',
      always: false,
    });
  });

  it('registers only safe ACP chat tools by default', () => {
    const group = createAcpChatGroup(createMockContainer());
    expect(group.name).toBe('acp_chat');
    expect(group.defaultLoaded).toBe(true);

    const defaultToolNames = group.tools
      .filter((tool) => !tool.profiles?.length && tool.riskLevel !== 'write')
      .map((tool) => tool.name);

    expect(defaultToolNames).toEqual([
      'acp_chat_get_session_state',
      'acp_chat_get_permission_state',
      'acp_chat_show_chat_view',
    ]);
    expect(group.tools.map((tool) => tool.name)).not.toContain('acp_chat_sendMessage');
    expect(group.tools.map((tool) => tool.name)).not.toContain('acp_chat_handlePermissionDialog');
  });

  it('returns active session metadata without prompt or response content', async () => {
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.name === 'acp_chat_get_session_state')!;

    const result = await tool.execute({});

    expect(result).toMatchObject({
      success: true,
      result: {
        active: true,
        session: {
          sessionId: 'acp:sess-1',
          rawSessionId: 'sess-1',
          threadStatus: 'working',
          requestCount: 1,
          historyMessageCount: 2,
          hasPendingPermission: true,
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('prompt');
    expect(JSON.stringify(result)).not.toContain('responseText');
  });

  it('returns session list metadata newest first without prompt or response content', async () => {
    const oldSession = {
      sessionId: 'acp:old',
      title: 'Old Session',
      modelId: 'claude',
      threadStatus: 'idle',
      createdAt: 1000,
      requests: [],
      slicedMessageCount: 0,
      history: {
        getMessages: jest.fn().mockReturnValue([
          { role: ChatMessageRole.User, content: 'old prompt content', timestamp: 1000 },
          { role: ChatMessageRole.Assistant, content: 'old response content' },
        ]),
        getMemorySummaries: jest.fn().mockReturnValue([]),
      },
    };
    const newestByFirstMessage = {
      sessionId: 'acp:newest-by-message',
      title: 'Newest By Message',
      modelId: 'claude',
      threadStatus: 'working',
      requests: [],
      slicedMessageCount: 0,
      history: {
        getMessages: jest.fn().mockReturnValue([
          { role: ChatMessageRole.User, content: 'new prompt content', timestamp: 3000 },
          { role: ChatMessageRole.Assistant, content: 'new response content' },
        ]),
        getMemorySummaries: jest.fn().mockReturnValue([]),
      },
    };
    const middleSession = {
      sessionId: 'acp:middle',
      title: 'Middle Session',
      modelId: 'claude',
      threadStatus: 'awaiting_prompt',
      createdAt: 2000,
      requests: [],
      slicedMessageCount: 0,
      history: {
        getMessages: jest
          .fn()
          .mockReturnValue([{ role: ChatMessageRole.User, content: 'middle prompt content', timestamp: 2000 }]),
        getMemorySummaries: jest.fn().mockReturnValue([]),
      },
    };
    const firstUntimestampedSession = {
      sessionId: 'acp:first-untimestamped',
      title: 'First Untimestamped Session',
      modelId: 'claude',
      threadStatus: 'idle',
      requests: [],
      slicedMessageCount: 0,
      history: {
        getMessages: jest.fn().mockReturnValue([{ role: ChatMessageRole.User, content: 'untimestamped prompt' }]),
        getMemorySummaries: jest.fn().mockReturnValue([]),
      },
    };
    const secondUntimestampedSession = {
      sessionId: 'acp:second-untimestamped',
      title: 'Second Untimestamped Session',
      modelId: 'claude',
      threadStatus: 'idle',
      requests: [],
      slicedMessageCount: 0,
      history: {
        getMessages: jest.fn().mockReturnValue([]),
        getMemorySummaries: jest.fn().mockReturnValue([]),
      },
    };
    mockChatInternalService.getSessions.mockReturnValueOnce([
      oldSession,
      newestByFirstMessage,
      firstUntimestampedSession,
      middleSession,
      secondUntimestampedSession,
    ]);
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.name === 'acp_chat_list_sessions')!;

    const result = await tool.execute({});

    expect(result).toMatchObject({
      success: true,
      result: {
        total: 5,
        sessions: [
          { sessionId: 'acp:newest-by-message', createdAt: 3000 },
          { sessionId: 'acp:middle', createdAt: 2000 },
          { sessionId: 'acp:old', createdAt: 1000 },
          { sessionId: 'acp:second-untimestamped', createdAt: 0 },
          { sessionId: 'acp:first-untimestamped', createdAt: 0 },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain('prompt content');
    expect(JSON.stringify(result)).not.toContain('response content');
  });

  it('returns permission counts without handling the permission decision', async () => {
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.name === 'acp_chat_get_permission_state')!;

    const result = await tool.execute({});

    expect(result).toMatchObject({
      success: true,
      result: {
        activeDialogCount: 1,
        activeSessionId: 'sess-1',
        pendingCountExcludingActive: 2,
      },
    });
  });

  it('prepares a relay digest without returning the full digest', async () => {
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.name === 'acp_chat_prepare_session_digest')!;

    const result = await tool.execute({ sourceSessionId: 'sess-1' });

    expect(mockRelaySummaryProvider.prepareSessionDigest).toHaveBeenCalledWith(mockSession, {
      maxSourceChars: undefined,
      maxDigestChars: undefined,
    });
    expect(mockRelayStore.put).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSessionId: 'acp:sess-1',
        digest: 'full digest content that should stay in the relay store',
      }),
    );
    expect(result).toMatchObject({
      success: true,
      result: {
        digestId: 'digest-1',
        sourceSessionId: 'acp:sess-1',
        preview: 'full digest content that should stay in the relay store',
      },
    });
    expect(JSON.stringify(result)).not.toContain('"digest":"full digest');
  });

  it('posts a prepared relay after permission and restores the original session', async () => {
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.name === 'acp_chat_post_prepared_relay')!;

    const result = await tool.execute({ digestId: 'digest-1', targetSessionId: 'sess-2' });

    expect(mockPermissionBridge.showPermissionDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Forward ACP chat digest',
        options: [
          { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
          { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
        ],
      }),
    );
    expect(mockChatInternalService.activateSession).toHaveBeenNthCalledWith(1, 'acp:sess-2');
    expect(mockChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        immediate: true,
        message: expect.stringContaining('[Forwarded from ACP session: Current Session]'),
      }),
    );
    expect(mockChatInternalService.activateSession).toHaveBeenNthCalledWith(2, 'acp:sess-1');
    expect(mockRelayStore.delete).toHaveBeenCalledWith('digest-1');
    expect(result).toMatchObject({
      success: true,
      result: {
        posted: true,
        targetSessionId: 'acp:sess-2',
        switchedSession: true,
      },
    });
  });

  it('does not post a relay when permission is rejected', async () => {
    mockPermissionBridge.showPermissionDialog.mockResolvedValueOnce({
      type: 'reject',
      optionId: 'reject',
      always: false,
    });
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.name === 'acp_chat_post_prepared_relay')!;

    const result = await tool.execute({ digestId: 'digest-1', targetSessionId: 'sess-2' });

    expect(result).toMatchObject({ success: false, error: 'PERMISSION_DENIED' });
    expect(mockChatService.sendMessage).not.toHaveBeenCalled();
  });

  it('reads bounded session message previews only in the full-profile tool', async () => {
    mockSession.history.getMessages.mockReturnValue([
      { id: 'm1', order: 1, role: ChatMessageRole.User, content: 'hello' },
      { id: 'm2', order: 2, role: ChatMessageRole.Assistant, content: 'world' },
      { id: 'm3', order: 3, role: ChatMessageRole.Function, content: 'tool result' },
    ]);
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.name === 'acp_chat_read_session_messages')!;

    const result = await tool.execute({ sessionId: 'sess-1', maxMessages: 10, maxChars: 100 });

    expect(result).toMatchObject({
      success: true,
      result: {
        sessionId: 'acp:sess-1',
        messages: [
          { role: 'user', contentPreview: 'hello' },
          { role: 'assistant', contentPreview: 'world' },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain('tool result');
  });
});
