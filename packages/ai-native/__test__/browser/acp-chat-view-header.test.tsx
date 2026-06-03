import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('react-chat-elements', () => ({
  MessageList: () => null,
}));

jest.mock('@opensumi/ide-core-browser', () => ({
  AINativeConfigService: Symbol('AINativeConfigService'),
  AppConfig: Symbol('AppConfig'),
  LabelService: Symbol('LabelService'),
  QuickPickService: Symbol('QuickPickService'),
  getIcon: (name: string) => `icon-${name}`,
  localize: (_key: string, defaultValue?: string) => defaultValue || _key,
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
  default: ({ title, variant, disabled, historyCollapsed, onNewChat, onToggleHistoryCollapsed }: any) =>
    require('react').createElement(
      'div',
      { 'data-testid': 'acp-chat-history', 'data-collapsed': String(!!historyCollapsed), 'data-variant': variant },
      title,
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
      onToggleHistoryCollapsed &&
        require('react').createElement(
          'button',
          {
            'data-testid': 'acp-chat-history-collapse',
            onClick: onToggleHistoryCollapsed,
            type: 'button',
          },
          'collapse',
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

jest.mock('../../src/browser/components/ChatMarkdown', () => ({
  ChatMarkdown: () => null,
}));

jest.mock('../../src/browser/components/ChatReply', () => ({
  ChatNotify: () => null,
  ChatReply: () => null,
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
  ChatProxyService: Symbol('ChatProxyService'),
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

import { AcpChatViewHeader } from '../../src/browser/acp/components/AcpChatViewHeader';
import { DefaultChatViewHeaderACP } from '../../src/browser/chat/chat.view.acp';

const disposable = () => ({ dispose: jest.fn() });

function createMockSession() {
  const history = {
    getMessages: jest.fn(() => [
      {
        role: ChatMessageRole.User,
        content: 'Current ACP session',
        replyStartTime: 1,
      },
    ]),
    onMessageChange: jest.fn(() => disposable()),
  };

  return {
    sessionId: 'acp:current',
    title: 'Current ACP session',
    history,
    threadStatus: 'idle',
    onThreadStatusChange: jest.fn(() => disposable()),
  };
}

function createMockServices({
  isMultiRoot = false,
  panelLayout = 'classic',
  createSessionModel,
}: {
  isMultiRoot?: boolean;
  panelLayout?: 'classic' | 'agentic';
  createSessionModel?: jest.Mock;
} = {}) {
  const session = createMockSession();
  const panelLayoutListeners = new Set<(mode: 'classic' | 'agentic') => void>();
  let currentPanelLayout = panelLayout;
  const aiChatService = {
    sessionModel: session,
    activateSession: jest.fn(),
    clearSessionModel: jest.fn(),
    createSessionModel: createSessionModel || jest.fn(),
    getSessions: jest.fn(() => [session]),
    getSessionsByAcp: jest.fn(() => Promise.resolve([session])),
    onChangeSession: jest.fn(() => disposable()),
    onSessionLoadingChange: jest.fn(() => disposable()),
  };

  return {
    aiChatService,
    chatFeatureRegistry: {
      getMessageSummaryProvider: jest.fn(() => undefined),
    },
    messageService: {
      error: jest.fn(),
    },
    permissionBridgeService: {
      getPendingCountExcludingActive: jest.fn(() => 0),
      hasPendingForSession: jest.fn(() => false),
      onActiveSessionChange: jest.fn(() => disposable()),
      onPendingCountChange: jest.fn(() => disposable()),
    },
    panelLayoutService: {
      getLayoutMode: jest.fn(() => currentPanelLayout),
      onDidChangePanelLayout: jest.fn((listener: (mode: 'classic' | 'agentic') => void) => {
        panelLayoutListeners.add(listener);
        return {
          dispose: jest.fn(() => {
            panelLayoutListeners.delete(listener);
          }),
        };
      }),
      setLayoutModeForTest: (mode: 'classic' | 'agentic') => {
        currentPanelLayout = mode;
        panelLayoutListeners.forEach((listener) => listener(mode));
      },
    },
    quickPick: {},
    workspaceService: {
      isMultiRootWorkspaceOpened: isMultiRoot,
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

    if (key.includes('ChatFeatureRegistry')) {
      return services.chatFeatureRegistry;
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
  });

  it('uses inline history in the ACP-specific header when panel layout is agentic', async () => {
    installInjectableMocks(createMockServices({ panelLayout: 'agentic' }));

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('[data-testid="acp-chat-history"]')?.getAttribute('data-variant')).toBe('inline');
    expect(container.querySelector('#ai-chat-header-close')).toBeNull();
  });

  it('collapses ACP history in agentic layout when the collapse action is clicked', async () => {
    installInjectableMocks(createMockServices({ panelLayout: 'agentic' }));

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('[data-testid="acp-chat-history"]')?.getAttribute('data-collapsed')).toBe('false');

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-history-collapse"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="acp-chat-history"]')?.getAttribute('data-collapsed')).toBe('true');
  });

  it('updates the ACP-specific history variant when panel layout changes at runtime', async () => {
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

    expect(container.querySelector('[data-testid="acp-chat-history"]')?.getAttribute('data-variant')).toBe('inline');
  });

  it('keeps agentic new-chat clicks single-flight while a session is being created', async () => {
    let resolveCreateSession: () => void;
    const createSessionModel = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCreateSession = resolve;
        }),
    );
    const services = createMockServices({ panelLayout: 'agentic', createSessionModel });
    installInjectableMocks(services);

    await renderHeader(
      React.createElement(AcpChatViewHeader, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    const newChatButton = container.querySelector('[data-testid="acp-chat-history-new"]') as HTMLButtonElement;

    await act(async () => {
      newChatButton.click();
      await Promise.resolve();
    });
    expect(createSessionModel).toHaveBeenCalledTimes(1);

    await act(async () => {
      newChatButton.click();
      await Promise.resolve();
    });
    expect(createSessionModel).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreateSession!();
      await Promise.resolve();
    });
  });
});
