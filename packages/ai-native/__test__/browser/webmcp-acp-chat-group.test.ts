import { ChatServiceToken } from '@opensumi/ide-core-common';

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
    },
  };

  const mockChatInternalService = {
    sessionModel: mockSession,
    getSessions: jest.fn().mockReturnValue([mockSession]),
    getAvailableCommands: jest.fn().mockReturnValue([{ name: '/explain', description: 'Explain code' }]),
    setSessionMode: jest.fn().mockResolvedValue(undefined),
  };

  const mockPermissionBridge = {
    getActiveDialogCount: jest.fn().mockReturnValue(1),
    getActiveSession: jest.fn().mockReturnValue('sess-1'),
    getPendingCountExcludingActive: jest.fn().mockReturnValue(2),
    hasPendingForSession: jest.fn().mockReturnValue(true),
  };

  const mockChatService = {
    showChatView: jest.fn(),
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
        throw new Error('DI token not mocked');
      }),
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers only safe ACP chat tools by default', () => {
    const group = createAcpChatGroup(createMockContainer());
    expect(group.name).toBe('acp_chat');
    expect(group.defaultLoaded).toBe(true);

    const defaultToolMethods = group.tools
      .filter((tool) => !tool.profiles?.length && tool.riskLevel !== 'write')
      .map((tool) => tool.method);

    expect(defaultToolMethods).toEqual([
      '_opensumi/acp_chat/getSessionState',
      '_opensumi/acp_chat/getPermissionState',
      '_opensumi/acp_chat/showChatView',
    ]);
    expect(group.tools.map((tool) => tool.method)).not.toContain('_opensumi/acp_chat/sendMessage');
    expect(group.tools.map((tool) => tool.method)).not.toContain('_opensumi/acp_chat/handlePermissionDialog');
  });

  it('returns active session metadata without prompt or response content', async () => {
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.method === '_opensumi/acp_chat/getSessionState')!;

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

  it('returns permission counts without handling the permission decision', async () => {
    const group = createAcpChatGroup(createMockContainer());
    const tool = group.tools.find((item) => item.method === '_opensumi/acp_chat/getPermissionState')!;

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
});
