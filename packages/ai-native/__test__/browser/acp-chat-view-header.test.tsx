import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('react-chat-elements', () => ({
  MessageList: () => null,
}));

jest.mock('@opensumi/ide-core-browser', () => ({
  AINativeConfigService: Symbol('AINativeConfigService'),
  AppConfig: Symbol('AppConfig'),
  COMMON_COMMANDS: {
    OPEN_PREFERENCES: {
      id: 'core.openpreference',
    },
  },
  LabelService: Symbol('LabelService'),
  PreferenceService: Symbol('PreferenceService'),
  QuickPickService: Symbol('QuickPickService'),
  getIcon: (name: string) => `icon-${name}`,
  localize: (_key: string, defaultValue?: string, ...args: string[]) =>
    (defaultValue || _key).replace(/\{(\d+)\}/g, (_, index) => args[Number(index)] || ''),
  useInjectable: jest.fn(),
  useUpdateOnEvent: jest.fn(),
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Popover: ({ children, id, title }: { children: React.ReactNode; id?: string; title?: string }) =>
    require('react').createElement('div', { id, title }, children),
  PopoverPosition: {
    left: 'left',
  },
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: ({ ariaLabel, className, onClick }: any) =>
    require('react').createElement('button', {
      'aria-label': ariaLabel,
      className,
      onClick,
      type: 'button',
    }),
}));

jest.mock('@opensumi/ide-editor', () => ({
  WorkbenchEditorService: Symbol('WorkbenchEditorService'),
}));

jest.mock('@opensumi/ide-main-layout', () => ({
  IMainLayoutService: Symbol('IMainLayoutService'),
}));

jest.mock('@opensumi/ide-overlay', () => ({
  IMessageService: Symbol('IMessageService'),
}));

jest.mock('@opensumi/ide-workspace', () => ({
  IWorkspaceService: Symbol('IWorkspaceService'),
}));

jest.mock('../../src/browser/acp/components/AcpChatHistory', () => ({
  __esModule: true,
  default: ({ title, variant, disabled, historyList = [], onNewChat, onHistoryItemSelect }: any) =>
    require('react').createElement(
      'div',
      {
        'data-testid': 'acp-chat-history',
        'data-title': title,
        'data-variant': variant,
      },
      require('react').createElement('div', {
        'data-testid': variant === 'inline' ? 'acp-chat-history-inline' : 'acp-chat-history-button',
      }),
      title,
      historyList.map((item: any) =>
        require('react').createElement(
          'button',
          {
            key: item.id,
            'data-created-at': String(item.createdAt),
            'data-testid': `acp-chat-history-item-${item.id}`,
            onClick: () => onHistoryItemSelect?.(item),
            type: 'button',
          },
          item.title,
        ),
      ),
      variant !== 'inline' &&
        require('react').createElement(
          'button',
          {
            'data-testid': 'acp-chat-history-new',
            disabled,
            onClick: onNewChat,
            type: 'button',
          },
          'new',
        ),
    ),
}));

jest.mock('../../src/browser/acp/components/AgenticTaskList', () => ({
  AgenticTaskList: () => require('react').createElement('aside', { 'data-testid': 'agentic-task-list' }),
}));

jest.mock('../../src/browser/components/ChatHistory', () => ({
  __esModule: true,
  default: ({ title, historyList = [], onHistoryItemSelect, onNewChat }: any) =>
    require('react').createElement(
      'div',
      { 'data-testid': 'chat-history' },
      title,
      historyList.map((item: any) =>
        require('react').createElement(
          'button',
          {
            key: item.id,
            'data-testid': `chat-history-item-${item.id}`,
            onClick: () => onHistoryItemSelect?.(item),
            type: 'button',
          },
          item.title,
        ),
      ),
      require('react').createElement(
        'button',
        {
          'data-testid': 'chat-history-new',
          onClick: onNewChat,
          type: 'button',
        },
        'new',
      ),
    ),
}));

jest.mock('../../src/browser/acp/components/AcpChatViewWrapper', () => ({
  AcpChatViewWrapper: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(React.Fragment, null, children),
}));

jest.mock('../../src/browser/acp/permission-bridge.service', () => ({
  AcpPermissionBridgeService: class AcpPermissionBridgeService {},
}));

jest.mock('../../src/browser/acp/agentic-workspace-switch.service', () => ({
  AgenticWorkspaceSwitchService: class AgenticWorkspaceSwitchService {},
}));

jest.mock('../../src/browser/layout/panel-layout.service', () => ({
  AIPanelLayoutService: class AIPanelLayoutService {},
}));

jest.mock('../../src/browser/chat/pick-workspace-dir', () => ({
  getCachedWorkspaceDir: jest.fn(() => '/workspace/root'),
  switchWorkspaceDir: jest.fn(() => Promise.resolve('/workspace/root')),
}));

jest.mock('../../src/browser/chat/chat-model', () => ({
  ChatModel: class ChatModel {},
  ChatRequestModel: class ChatRequestModel {},
  ChatSlashCommandItemModel: class ChatSlashCommandItemModel {},
}));

jest.mock('../../src/browser/components/ChangeList', () => ({
  FileListDisplay: () => null,
}));

jest.mock('../../src/browser/components/ChatEditor', () => ({
  CodeBlockWrapperInput: () => null,
}));

jest.mock('../../src/browser/components/ChatInput', () => ({
  ChatInput: () => null,
}));

jest.mock('../../src/browser/components/ChatMentionInput', () => ({
  ChatMentionInput: () => null,
}));

jest.mock('../../src/browser/components/ChatMarkdown', () => ({
  ChatMarkdown: () => null,
}));

jest.mock('../../src/browser/components/ChatReply', () => ({
  ChatNotify: () => null,
  ChatReply: () => require('react').createElement('div', { 'data-testid': 'chat-reply' }),
}));

jest.mock('../../src/browser/components/SlashCustomRender', () => ({
  SlashCustomRender: () => null,
}));

jest.mock('../../src/browser/components/utils', () => ({
  createMessageByAI: jest.fn(),
  createMessageByUser: jest.fn(),
}));

jest.mock('../../src/browser/components/WelcomeMsg', () => ({
  WelcomeMessage: () => null,
}));

jest.mock('../../src/browser/mcp/base-apply.service', () => ({
  BaseApplyService: Symbol('BaseApplyService'),
}));

jest.mock('../../src/browser/chat/chat-proxy.service', () => ({
  ChatProxyService: {
    AGENT_ID: 'default-agent',
  },
}));

jest.mock('../../src/browser/chat/chat.api.service', () => ({
  ChatService: Symbol('ChatService'),
}));

jest.mock('../../src/browser/chat/chat.feature.registry', () => ({
  ChatFeatureRegistry: class ChatFeatureRegistry {},
}));

jest.mock('../../src/browser/chat/chat.history.registry', () => ({
  IChatHistoryRegistry: Symbol('IChatHistoryRegistry'),
}));

jest.mock('../../src/browser/chat/chat.input.registry', () => ({
  ChatInputRegistry: class ChatInputRegistry {},
}));

jest.mock('../../src/browser/chat/chat.internal.service', () => ({
  ChatInternalService: class ChatInternalService {},
}));

jest.mock('../../src/browser/chat/chat.internal.service.acp', () => ({
  AcpChatInternalService: class AcpChatInternalService {},
}));

jest.mock('../../src/browser/chat/chat.render.registry', () => ({
  ChatRenderRegistry: class ChatRenderRegistry {},
}));

import { ChatMessageRole } from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

import { AcpChatViewHeader } from '../../src/browser/acp/components/AcpChatViewHeader';
import { DefaultChatViewHeader } from '../../src/browser/chat/chat.view';
import { AIChatViewACPContent, DefaultChatViewHeaderACP } from '../../src/browser/chat/chat.view.acp';

const disposable = () => ({ dispose: jest.fn() });
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function createMockSession({
  createdAt,
  messages,
  title = 'Current ACP session',
}: {
  createdAt?: number;
  messages?: Array<{
    role: ChatMessageRole;
    content: string;
    replyStartTime?: number;
    timestamp?: number;
  }>;
  title?: string;
} = {}) {
  const history = {
    addAssistantMessage: jest.fn(() => 'assistant-message'),
    addUserMessage: jest.fn(),
    getMessages: jest.fn(
      () =>
        messages || [
          {
            role: ChatMessageRole.User,
            content: 'Current ACP session',
            replyStartTime: 1,
          },
        ],
    ),
    onMessageChange: jest.fn(() => disposable()),
  };

  return {
    sessionId: 'acp:current',
    createdAt,
    title,
    history,
    threadStatus: 'idle',
    onThreadStatusChange: jest.fn(() => disposable()),
  };
}

function createMockServices({
  isMultiRoot = false,
  panelLayout = 'classic',
  defaultAgentType = 'claude-agent-acp',
  agentConfigs = {},
  createSessionModel,
  enterDraftSession,
  ensureSessionModel,
  createRequest,
  sendRequest,
  session,
  sessions,
  chatViewHeaderRender,
}: {
  isMultiRoot?: boolean;
  panelLayout?: 'classic' | 'agentic';
  defaultAgentType?: string;
  agentConfigs?: Record<string, { command?: string; args?: string[]; description?: string; streaming?: boolean }>;
  createSessionModel?: jest.Mock;
  createRequest?: jest.Mock;
  enterDraftSession?: jest.Mock;
  ensureSessionModel?: jest.Mock;
  sendRequest?: jest.Mock;
  session?: ReturnType<typeof createMockSession> | null;
  sessions?: ReturnType<typeof createMockSession>[];
  chatViewHeaderRender?: any;
} = {}) {
  const currentSession = session === undefined ? createMockSession() : session;
  const sessionList = sessions || (currentSession ? [currentSession] : []);
  const panelLayoutListeners = new Set<(mode: 'classic' | 'agentic') => void>();
  const agenticWorkbenchVisibilityListeners = new Set<(visible: boolean) => void>();
  const defaultAgentTypeListeners = new Set<(change: { newValue: string }) => void>();
  const agentConfigListeners = new Set<(change: { newValue: typeof agentConfigs }) => void>();
  const cancelRequestListeners = new Set<() => void>();
  let currentPanelLayout = panelLayout;
  let currentDefaultAgentType = defaultAgentType;
  let currentAgentConfigs = agentConfigs;
  let agenticWorkbenchVisible = true;
  const aiChatService = {
    sessionModel: currentSession,
    activateSession: jest.fn(),
    cancelRequest: jest.fn(() => {
      cancelRequestListeners.forEach((listener) => listener());
    }),
    clearSessionModel: jest.fn(),
    createRequest:
      createRequest ||
      jest.fn(() => ({
        message: {
          agentId: 'default-agent',
          prompt: 'hello',
        },
        requestId: 'request-1',
        response: {
          isComplete: false,
        },
      })),
    createSessionModel: createSessionModel || jest.fn(),
    enterDraftSession: enterDraftSession || jest.fn(),
    getDraftSessionState: jest.fn(() => ({ isDraft: false })),
    ensureSessionModel:
      ensureSessionModel ||
      jest.fn(async () => {
        if (!aiChatService.sessionModel && currentSession) {
          aiChatService.sessionModel = currentSession;
        }
        return aiChatService.sessionModel;
      }),
    getSessions: jest.fn(() => sessionList),
    getSessionsByAcp: jest.fn(() => Promise.resolve(sessionList)),
    latestRequestId: 'request-1',
    onCancelRequest: jest.fn((listener: () => void) => {
      cancelRequestListeners.add(listener);
      return {
        dispose: jest.fn(() => {
          cancelRequestListeners.delete(listener);
        }),
      };
    }),
    onChangeSession: jest.fn(() => disposable()),
    onSessionModelChange: jest.fn(() => disposable()),
    onSessionLoadingChange: jest.fn(() => disposable()),
    sendRequest: sendRequest || jest.fn(),
    setLatestRequestId: jest.fn(),
  };
  const ChatInputForTest = React.forwardRef((_props: any, _ref) => {
    const props = _props;
    return React.createElement(
      'div',
      null,
      React.createElement(
        'button',
        {
          'data-testid': 'acp-chat-send',
          onClick: () => props.onSend('hello'),
          type: 'button',
        },
        'send',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'acp-chat-send-followup',
          onClick: () => props.onSend('follow up'),
          type: 'button',
        },
        'send followup',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'acp-chat-send-whitespace',
          onClick: () => props.onSend('   \n\t  '),
          type: 'button',
        },
        'send whitespace',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'acp-chat-send-empty-html',
          onClick: () => props.onSend('<div><br></div>&nbsp;<span> </span>'),
          type: 'button',
        },
        'send empty html',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'acp-chat-send-command-only',
          onClick: () => props.onSend('   ', undefined, undefined, 'generate'),
          type: 'button',
        },
        'send command only',
      ),
    );
  });

  return {
    aiChatService,
    aiNativeConfigService: {
      capabilities: {
        supportsAgentMode: true,
      },
    },
    aiReporter: {
      start: jest.fn(() => 'relation-1'),
    },
    appConfig: {
      workspaceDir: '/workspace/root',
    },
    applyService: {
      getSessionCodeBlocks: jest.fn(() => []),
      onCodeBlockUpdate: jest.fn(() => disposable()),
      processAll: jest.fn(),
    },
    chatAgentService: {
      getCommands: jest.fn(() => []),
      getDefaultAgentId: jest.fn(() => undefined),
      onDidChangeAgents: jest.fn(() => disposable()),
      onDidSendMessage: jest.fn(() => disposable()),
    },
    chatApiService: {
      clearHistoryMessages: jest.fn(),
      onChatMessageLaunch: jest.fn(() => disposable()),
      onChatMessageListLaunch: jest.fn(() => disposable()),
      onChatReplyMessageLaunch: jest.fn(() => disposable()),
      onScrollToBottom: jest.fn(() => disposable()),
    },
    chatFeatureRegistry: {
      getAllShortcutSlashCommand: jest.fn(() => []),
      getSlashCommandHandler: jest.fn(() => undefined),
      getMessageSummaryProvider: jest.fn(() => undefined),
    },
    chatInputRegistry: {
      getActiveChatInput: jest.fn(() => ({
        component: ChatInputForTest,
      })),
    },
    chatRenderRegistry: {
      chatViewHeaderRender,
    },
    commandService: {
      executeCommand: jest.fn(),
    },
    editorService: {
      open: jest.fn(),
    },
    labelService: {},
    layoutService: {
      toggleSlot: jest.fn(),
    },
    llmContextService: {},
    messageService: {
      error: jest.fn(),
      info: jest.fn(),
    },
    mcpServerRegistry: {},
    permissionBridgeService: {
      getPendingCountExcludingActive: jest.fn(() => 0),
      hasPendingForSession: jest.fn(() => false),
      onActiveSessionChange: jest.fn(() => disposable()),
      onPendingCountChange: jest.fn(() => disposable()),
    },
    preferenceService: {
      get: jest.fn((preferenceName: string, fallback: unknown) => {
        if (preferenceName === AINativeSettingSectionsId.DefaultAgentType) {
          return currentDefaultAgentType;
        }
        if (preferenceName === AINativeSettingSectionsId.AgentConfigs) {
          return currentAgentConfigs;
        }
        return fallback;
      }),
      onSpecificPreferenceChange: jest.fn((preferenceName: string, listener: any) => {
        if (preferenceName === AINativeSettingSectionsId.DefaultAgentType) {
          defaultAgentTypeListeners.add(listener);
        }
        if (preferenceName === AINativeSettingSectionsId.AgentConfigs) {
          agentConfigListeners.add(listener);
        }
        return {
          dispose: jest.fn(() => {
            defaultAgentTypeListeners.delete(listener);
            agentConfigListeners.delete(listener);
          }),
        };
      }),
      set: jest.fn(async (preferenceName: string, value: string) => {
        if (preferenceName === AINativeSettingSectionsId.DefaultAgentType) {
          currentDefaultAgentType = value;
          defaultAgentTypeListeners.forEach((listener) => listener({ newValue: value }));
        }
        if (preferenceName === AINativeSettingSectionsId.AgentConfigs) {
          currentAgentConfigs = value as any;
          agentConfigListeners.forEach((listener) => listener({ newValue: currentAgentConfigs }));
        }
      }),
    },
    panelLayoutService: {
      getLayoutMode: jest.fn(() => currentPanelLayout),
      isAgenticWorkbenchVisible: jest.fn(() =>
        currentPanelLayout === 'agentic' ? agenticWorkbenchVisible : undefined,
      ),
      onDidChangePanelLayout: jest.fn((listener: (mode: 'classic' | 'agentic') => void) => {
        panelLayoutListeners.add(listener);
        return {
          dispose: jest.fn(() => {
            panelLayoutListeners.delete(listener);
          }),
        };
      }),
      onDidChangeAgenticWorkbenchVisibility: jest.fn((listener: (visible: boolean) => void) => {
        agenticWorkbenchVisibilityListeners.add(listener);
        return {
          dispose: jest.fn(() => {
            agenticWorkbenchVisibilityListeners.delete(listener);
          }),
        };
      }),
      setLayoutModeForTest: (mode: 'classic' | 'agentic') => {
        currentPanelLayout = mode;
        panelLayoutListeners.forEach((listener) => listener(mode));
      },
      toggleAgenticWorkbenchVisibility: jest.fn((visible?: boolean) => {
        if (currentPanelLayout !== 'agentic') {
          return undefined;
        }
        agenticWorkbenchVisible = visible ?? !agenticWorkbenchVisible;
        agenticWorkbenchVisibilityListeners.forEach((listener) => listener(agenticWorkbenchVisible));
        return agenticWorkbenchVisible;
      }),
    },
    quickPick: {},
    workspaceService: {
      asRelativePath: jest.fn(async () => undefined),
      isMultiRootWorkspaceOpened: isMultiRoot,
    },
    workspaceSwitch: {
      restorePendingWork: jest.fn(() => Promise.resolve()),
    },
  };
}

function installInjectableMocks(services: ReturnType<typeof createMockServices>) {
  jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: any) => {
    const key = String(token);
    const name = token?.name || '';

    if (key.includes('IChatInternalService')) {
      return services.aiChatService;
    }

    if (key.includes('AINativeConfigService')) {
      return services.aiNativeConfigService;
    }

    if (key.includes('AppConfig')) {
      return services.appConfig;
    }

    if (key.includes('BaseApplyService')) {
      return services.applyService;
    }

    if (key.includes('ChatInputRegistry')) {
      return services.chatInputRegistry;
    }

    if (key.includes('ChatRenderRegistry')) {
      return services.chatRenderRegistry;
    }

    if (key.includes('ChatServiceToken')) {
      return services.chatApiService;
    }

    if (key.includes('CommandService')) {
      return services.commandService;
    }

    if (key.includes('ChatFeatureRegistry')) {
      return services.chatFeatureRegistry;
    }

    if (key.includes('IAIReporter')) {
      return services.aiReporter;
    }

    if (key.includes('IChatAgentService')) {
      return services.chatAgentService;
    }

    if (key.includes('IMainLayoutService')) {
      return services.layoutService;
    }

    if (key.includes('LabelService')) {
      return services.labelService;
    }

    if (key.includes('PreferenceService')) {
      return services.preferenceService;
    }

    if (key.includes('LLMContextServiceToken')) {
      return services.llmContextService;
    }

    if (key.includes('TokenMCPServerRegistry')) {
      return services.mcpServerRegistry;
    }

    if (key.includes('WorkbenchEditorService')) {
      return services.editorService;
    }

    if (key.includes('IMessageService')) {
      return services.messageService;
    }

    if (key.includes('IWorkspaceService')) {
      return services.workspaceService;
    }

    if (key.includes('QuickPickService')) {
      return services.quickPick;
    }

    if (name === 'AcpPermissionBridgeService') {
      return services.permissionBridgeService;
    }

    if (name === 'AIPanelLayoutService') {
      return services.panelLayoutService;
    }

    if (name === 'AgenticWorkspaceSwitchService') {
      return services.workspaceSwitch;
    }

    return {};
  });
}

describe('ACP chat view headers', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  async function renderHeader(component: React.ReactElement) {
    await act(async () => {
      root.render(component);
      await Promise.resolve();
    });
  }

  it('hides the clear action in the default ACP chat header while keeping history and close actions', async () => {
    installInjectableMocks(createMockServices());

    await renderHeader(
      React.createElement(DefaultChatViewHeaderACP, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('#ai-chat-header-clear')).toBeNull();
    expect(container.querySelector('#ai-chat-header-close')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history"]')).not.toBeNull();
  });

  it('hides the close action in the default ACP chat header when panel layout is agentic', async () => {
    installInjectableMocks(createMockServices({ panelLayout: 'agentic' }));

    await renderHeader(
      React.createElement(DefaultChatViewHeaderACP, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('#ai-chat-header-close')).toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history"]')).not.toBeNull();
  });

  it('shows current session title and maximizes the default ACP chat header in agentic layout', async () => {
    const session = createMockSession({
      title: 'Server session title',
      messages: [
        {
          role: ChatMessageRole.User,
          content: 'Message fallback title',
          replyStartTime: 1,
        },
      ],
    });
    const services = createMockServices({ panelLayout: 'agentic', session });
    installInjectableMocks(services);

    await renderHeader(
      React.createElement(DefaultChatViewHeaderACP, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('[data-testid="acp-chat-history"]')?.getAttribute('data-title')).toBe(
      'Server session title',
    );

    const maximize = container.querySelector('#ai-chat-header-maximize button') as HTMLButtonElement;
    expect(maximize).not.toBeNull();

    await act(async () => {
      maximize.click();
      await Promise.resolve();
    });

    expect(services.panelLayoutService.toggleAgenticWorkbenchVisibility).toHaveBeenCalledWith(false);
  });

  it('does not show the maximize action in the default ACP chat header in classic layout', async () => {
    installInjectableMocks(createMockServices({ panelLayout: 'classic' }));

    await renderHeader(
      React.createElement(DefaultChatViewHeaderACP, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('#ai-chat-header-maximize')).toBeNull();
  });

  it('hides the clear action in the ACP-specific header while keeping workspace switch and close actions', async () => {
    installInjectableMocks(createMockServices({ isMultiRoot: true }));

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('#ai-chat-header-clear')).toBeNull();
    expect(container.querySelector('#ai-chat-header-switch-cwd')).not.toBeNull();
    expect(container.querySelector('#ai-chat-header-close')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history"]')).not.toBeNull();
  });

  it('uses popover history in the ACP-specific header when panel layout is classic', async () => {
    installInjectableMocks(createMockServices({ panelLayout: 'classic' }));

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('[data-testid="acp-chat-history"]')?.getAttribute('data-variant')).toBe('popover');
    expect(container.querySelector('[data-testid="acp-chat-history-button"]')).not.toBeNull();
  });

  it('passes session creation time to the ACP-specific history list', async () => {
    installInjectableMocks(createMockServices({ session: createMockSession({ createdAt: 12345 }) }));

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(
      container.querySelector('[data-testid="acp-chat-history-item-acp:current"]')?.getAttribute('data-created-at'),
    ).toBe('12345');
  });

  it('falls back to the first message timestamp for default ACP history creation time', async () => {
    installInjectableMocks(
      createMockServices({
        session: createMockSession({
          messages: [
            {
              role: ChatMessageRole.User,
              content: 'Current ACP session',
              timestamp: 67890,
            },
          ],
        }),
      }),
    );

    await renderHeader(
      React.createElement(DefaultChatViewHeaderACP, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(
      container.querySelector('[data-testid="acp-chat-history-item-acp:current"]')?.getAttribute('data-created-at'),
    ).toBe('67890');
  });

  it('renders the persistent Task List instead of inline ACP history in the Agentic Layout', async () => {
    const services = createMockServices({ panelLayout: 'agentic' });
    installInjectableMocks(services);

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('[data-testid="agentic-task-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-inline"]')).toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history"]')).toBeNull();
    expect(services.workspaceSwitch.restorePendingWork).toHaveBeenCalledTimes(1);
    expect(container.querySelector('#ai-chat-header-close')).toBeNull();
  });

  it('toggles maximize and restore from the agentic chat panel header', async () => {
    const services = createMockServices({
      panelLayout: 'agentic',
      session: createMockSession({
        title: 'ACP-specific server title',
        messages: [
          {
            role: ChatMessageRole.User,
            content: 'ACP-specific message fallback',
          },
        ],
      }),
      chatViewHeaderRender: AcpChatViewHeader,
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    expect(container.querySelector('[data-testid="agentic-chat-panel-header-title"]')?.textContent).toBe(
      'ACP-specific server title',
    );
    expect(container.querySelector('[data-testid="agentic-task-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-inline"]')).toBeNull();
    expect(container.querySelector('#ai-chat-header-maximize')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-chat-new-session-button"]')).toBeNull();

    const getAction = () =>
      container.querySelector('#agentic-chat-panel-header-maximize button') as HTMLButtonElement | null;
    expect(getAction()?.className).toBe('icon-fullescreen');

    await act(async () => {
      getAction()?.click();
      await Promise.resolve();
    });

    expect(services.panelLayoutService.toggleAgenticWorkbenchVisibility).toHaveBeenCalledWith(false);
    expect(getAction()?.className).toBe('icon-unfullscreen');

    await act(async () => {
      getAction()?.click();
      await Promise.resolve();
    });

    expect(services.panelLayoutService.toggleAgenticWorkbenchVisibility).toHaveBeenCalledWith(true);
    expect(getAction()?.className).toBe('icon-fullescreen');
  });

  it('maximizes the default chat header in agentic layout', async () => {
    const services = createMockServices({ panelLayout: 'agentic' });
    installInjectableMocks(services);

    await renderHeader(
      React.createElement(DefaultChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    const maximize = container.querySelector('#ai-chat-header-maximize button') as HTMLButtonElement;
    expect(maximize).not.toBeNull();

    await act(async () => {
      maximize.click();
      await Promise.resolve();
    });

    expect(services.panelLayoutService.toggleAgenticWorkbenchVisibility).toHaveBeenCalledWith(false);
  });

  it('switches the ACP Chat Slot between Classic history and the Agentic Task List at runtime', async () => {
    const services = createMockServices({ panelLayout: 'classic' });
    installInjectableMocks(services);

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('[data-testid="acp-chat-history"]')?.getAttribute('data-variant')).toBe('popover');

    await act(async () => {
      services.panelLayoutService.setLayoutModeForTest('agentic');
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="agentic-task-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history"]')).toBeNull();
    expect(services.workspaceSwitch.restorePendingWork).toHaveBeenCalledTimes(1);
  });

  it('enters draft when switching ACP workspace cwd without creating a session', async () => {
    const pickWorkspaceDir = jest.requireMock('../../src/browser/chat/pick-workspace-dir');
    pickWorkspaceDir.switchWorkspaceDir.mockResolvedValueOnce('/workspace/next');
    const createSessionModel = jest.fn();
    const enterDraftSession = jest.fn();
    const services = createMockServices({
      isMultiRoot: true,
      createSessionModel,
      enterDraftSession,
    });
    installInjectableMocks(services);

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    const switchButton = container.querySelector('#ai-chat-header-switch-cwd button') as HTMLButtonElement;
    await act(async () => {
      switchButton.click();
      await Promise.resolve();
    });

    expect(enterDraftSession).toHaveBeenCalledTimes(1);
    expect(createSessionModel).not.toHaveBeenCalled();
  });

  it('keeps history item selection activating the selected ACP session', async () => {
    const historySession = createMockSession({ createdAt: 1 });
    const services = createMockServices({ sessions: [historySession] });
    installInjectableMocks(services);

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-history-item-acp:current"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(services.aiChatService.activateSession).toHaveBeenCalledWith('acp:current');
  });

  it('creates an ACP session on first draft send before writing chat history', async () => {
    const session = createMockSession({ messages: [] });
    const createRequest = jest.fn(() => ({
      message: {
        agentId: 'default-agent',
        prompt: 'hello',
      },
      requestId: 'request-1',
      response: {
        isComplete: false,
      },
    }));
    const ensureSessionModel = jest.fn(async () => session);
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      ensureSessionModel,
      sendRequest,
      session: null,
      sessions: [],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(ensureSessionModel).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledWith('hello', 'default-agent', undefined, undefined);
    expect(ensureSessionModel.mock.invocationCallOrder[0]).toBeLessThan(createRequest.mock.invocationCallOrder[0]);
    expect(session.history.addUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'hello',
        relationId: 'relation-1',
      }),
    );
    expect(session.history.addAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        relationId: 'relation-1',
        requestId: 'request-1',
      }),
    );
    expect(sendRequest).toHaveBeenCalledWith(createRequest.mock.results[0].value);
    expect(services.mcpServerRegistry).toEqual({
      activeMessageInfo: {
        messageId: 'assistant-message',
        sessionId: 'acp:current',
      },
    });
  });

  it('renders ACP replies with Deep Thinking collapsed by default', async () => {
    const session = createMockSession({ messages: [] });
    const createRequest = jest.fn(() => ({
      message: {
        agentId: 'default-agent',
        prompt: 'hello',
      },
      requestId: 'request-1',
      response: {
        isComplete: false,
      },
    }));
    const services = createMockServices({
      createRequest,
      ensureSessionModel: jest.fn(async () => session),
      session: null,
      sessions: [],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    const createMessageByAI = jest.requireMock('../../src/browser/components/utils').createMessageByAI as jest.Mock;
    const chatReplyElement = createMessageByAI.mock.calls
      .map(([message]) => message.text)
      .find((text) => text?.props?.request);
    expect(chatReplyElement.props.collapseReasoningByDefault).toBe(true);
    expect(chatReplyElement.props.keepReasoningExpandedOnComplete).toBeUndefined();
  });

  it('queues follow-up ACP messages while a reply is loading and sends them after the reply completes', async () => {
    const session = createMockSession({ messages: [] });
    const createRequest = jest
      .fn()
      .mockImplementation((message: string, agentId: string, images?: string[], command?: string) => ({
        message: {
          agentId,
          command,
          images,
          prompt: message,
        },
        requestId: `request-${createRequest.mock.calls.length + 1}`,
        response: {
          isComplete: false,
        },
      }));
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      ensureSessionModel: jest.fn(async () => session),
      sendRequest,
      session: null,
      sessions: [],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(sendRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(sendRequest).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="acp-queued-messages-summary"]')?.textContent).toContain(
      '1 Queued Message',
    );
    expect(container.querySelector('[data-testid="acp-queued-message-preview"]')?.textContent).toContain('follow up');

    const createMessageByAI = jest.requireMock('../../src/browser/components/utils').createMessageByAI as jest.Mock;
    const chatReplyElement = createMessageByAI.mock.calls
      .map(([message]) => message.text)
      .find((text) => text?.props?.request);

    await act(async () => {
      chatReplyElement.props.onDone();
      await flushPromises();
    });

    expect(createRequest).toHaveBeenNthCalledWith(2, 'follow up', 'default-agent', undefined, undefined);
    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="acp-queued-messages-summary"]')).toBeNull();
  });

  it('ignores whitespace-only draft sends before creating an ACP session', async () => {
    const createRequest = jest.fn();
    const ensureSessionModel = jest.fn();
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      ensureSessionModel,
      sendRequest,
      session: null,
      sessions: [],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-whitespace"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(ensureSessionModel).not.toHaveBeenCalled();
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it('ignores contenteditable blank markup before creating an ACP session', async () => {
    const createRequest = jest.fn();
    const ensureSessionModel = jest.fn();
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      ensureSessionModel,
      sendRequest,
      session: null,
      sessions: [],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-empty-html"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(ensureSessionModel).not.toHaveBeenCalled();
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it('keeps command-only ACP sends valid', async () => {
    const session = createMockSession({ messages: [] });
    const createRequest = jest.fn(() => ({
      message: {
        agentId: 'default-agent',
        command: 'generate',
        prompt: '   ',
      },
      requestId: 'request-1',
      response: {
        isComplete: false,
      },
    }));
    const ensureSessionModel = jest.fn(async () => session);
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      ensureSessionModel,
      sendRequest,
      session: null,
      sessions: [],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-command-only"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(ensureSessionModel).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledWith('   ', 'default-agent', undefined, 'generate');
    expect(sendRequest).toHaveBeenCalledWith(createRequest.mock.results[0].value);
  });
});
