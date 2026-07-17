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
  CommandService: Symbol('CommandService'),
  LabelService: Symbol('LabelService'),
  KeybindingRegistry: Symbol('KeybindingRegistry'),
  PreferenceService: Symbol('PreferenceService'),
  QuickPickService: Symbol('QuickPickService'),
  getIcon: (name: string) => `icon-${name}`,
  localize: (_key: string, defaultValue?: string, ...args: string[]) =>
    (defaultValue || _key).replace(/\{(\d+)\}/g, (_, index) => args[Number(index)] || ''),
  useInjectable: jest.fn(),
  useUpdateOnEvent: jest.fn(),
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ className, iconClass }: { className?: string; iconClass?: string }) =>
    require('react').createElement('span', { className: [className, iconClass].filter(Boolean).join(' ') }),
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
import { AI_CHAT_NEW_CHAT, AI_CHAT_NEW_TASK } from '../../src/browser/chat/acp-new-draft.commands';
import { DefaultChatViewHeader } from '../../src/browser/chat/chat.view';
import { AIChatViewACPContent, DefaultChatViewHeaderACP } from '../../src/browser/chat/chat.view.acp';

const disposable = () => ({ dispose: jest.fn() });
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createRequestResponse() {
  const listeners = new Set<() => void>();
  const response = {
    isComplete: false,
    isCanceled: false,
    errorDetails: undefined as { message: string } | undefined,
    onDidChange(listener: () => void) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    setErrorDetails(errorDetails: { message: string }) {
      response.errorDetails = errorDetails;
    },
    complete() {
      response.isComplete = true;
      listeners.forEach((listener) => listener());
    },
    finish(outcome: 'completed' | 'manual-stop' | 'agent-error') {
      response.isComplete = true;
      response.isCanceled = outcome === 'manual-stop';
      response.errorDetails = outcome === 'agent-error' ? { message: 'agent failed' } : undefined;
      listeners.forEach((listener) => listener());
    },
    get listenerCount() {
      return listeners.size;
    },
  };
  return response;
}

function createMockSession({
  createdAt,
  messages,
  sessionId = 'acp:current',
  title = 'Current ACP session',
  modelId = 'model-1',
  currentModeId = 'mode-1',
  configOptions = [{ id: 'temperature', value: 'low' }],
}: {
  createdAt?: number;
  messages?: Array<{
    role: ChatMessageRole;
    content: string;
    replyStartTime?: number;
    timestamp?: number;
  }>;
  sessionId?: string;
  title?: string;
  modelId?: string;
  currentModeId?: string;
  configOptions?: Array<{ id: string; value: string }>;
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
    sessionId,
    createdAt,
    title,
    modelId,
    currentModeId,
    configOptions,
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
  activeInputCapabilities = ['rich-queued-edit'],
  withQueuedEditor = true,
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
  activeInputCapabilities?: string[];
  withQueuedEditor?: boolean;
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
  const workspaceChangedListeners = new Set<() => void>();
  const workspaceLocationChangedListeners = new Set<() => void>();
  let latestChatInputProps: any;
  let latestQueuedEditorProps: any;
  let activeInputHandle: { focus: jest.Mock; restoreDraft: jest.Mock; setExpanded: jest.Mock } | null = null;
  let activeInputHandleOwnerId: string | undefined;
  const mainInputFocus = jest.fn();
  const mainInputRestoreDraft = jest.fn();
  const mainInputSetExpanded = jest.fn();
  const queuedEditorFocus = jest.fn();
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
        response: createRequestResponse(),
      })),
    createSessionModel: createSessionModel || jest.fn(),
    enterDraftSession: enterDraftSession || jest.fn(),
    getDraftSessionState: jest.fn(() => ({ isDraft: false })),
    getInputDraft: jest.fn(() => undefined),
    getActiveAgenticTaskAgentId: jest.fn(() => undefined),
    ensureSessionModel: jest.fn(async () => {
      const ensuredSession = ensureSessionModel
        ? await ensureSessionModel()
        : aiChatService.sessionModel || currentSession;
      if (ensuredSession) {
        aiChatService.sessionModel = ensuredSession;
      }
      return ensuredSession;
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
    updateInputDraft: jest.fn(),
  };
  const ChatInputForTest = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    latestChatInputProps = props;
    React.useEffect(() => {
      const handle = {
        focus: mainInputFocus,
        restoreDraft: mainInputRestoreDraft,
        setExpanded: mainInputSetExpanded,
      };
      props.onInputHandleReady?.(handle);
      return () => props.onInputHandleReady?.(null);
    }, [props.onInputHandleReady]);
    return React.createElement(
      'div',
      { ref },
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
          'data-testid': 'acp-chat-send-later-followup',
          onClick: () => props.onSend('later follow up'),
          type: 'button',
        },
        'send later followup',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'acp-chat-send-immediate',
          onClick: () => props.turnActions.submit({ message: 'idle immediate' }, 'immediate'),
          type: 'button',
        },
        'send immediate',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'acp-chat-stop',
          onClick: () => props.turnActions.stop(),
          type: 'button',
        },
        'stop',
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
  const QueuedEditorForTest = (props: any) => {
    latestQueuedEditorProps = props;
    React.useEffect(() => {
      props.onReady?.({ focus: queuedEditorFocus });
      return () => props.onReady?.(null);
    }, [props.onReady]);
    return React.createElement(
      'div',
      { 'data-testid': 'test-queued-editor' },
      React.createElement(
        'button',
        {
          'data-testid': 'test-queued-editor-save',
          onClick: () => props.onSave({ ...props.turn, message: 'edited queued turn' }),
          type: 'button',
        },
        'save',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'test-queued-editor-cancel',
          onClick: props.onCancel,
          type: 'button',
        },
        'cancel',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'test-queued-editor-immediate',
          onClick: () => props.onImmediateSend({ ...props.turn, message: 'edited immediate turn' }),
          type: 'button',
        },
        'immediate',
      ),
    );
  };
  let activeChatInput = {
    id: 'test-input',
    component: ChatInputForTest,
    capabilities: activeInputCapabilities,
    queuedTurnEditor: withQueuedEditor ? QueuedEditorForTest : undefined,
  };

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
    agenticTaskRegistry: {
      getProject: jest.fn(() => Promise.resolve(undefined)),
      getTask: jest.fn(() => Promise.resolve(undefined)),
      listProjects: jest.fn(() => Promise.resolve([])),
      onDidChange: jest.fn(() => disposable()),
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
      focusActiveInput: jest.fn(() => activeInputHandle?.focus?.()),
      getActiveChatInput: jest.fn(() => activeChatInput),
      getActiveInputHandle: jest.fn(() => activeInputHandle),
      preserveActiveDraft: jest.fn(),
      restoreActiveDraft: jest.fn(),
      setActiveInputHandle: jest.fn(
        (handle: { focus: jest.Mock; restoreDraft: jest.Mock; setExpanded: jest.Mock } | null, ownerId?: string) => {
          if (handle && ownerId !== activeChatInput.id) {
            return;
          }
          if (!handle && ownerId !== activeInputHandleOwnerId) {
            return;
          }
          activeInputHandle = handle;
          activeInputHandleOwnerId = handle ? ownerId : undefined;
        },
      ),
    },
    keybindingRegistry: {
      acceleratorFor: jest.fn(() => []),
      getKeybindingsForCommand: jest.fn(() => []),
      onKeybindingsChanged: jest.fn(() => disposable()),
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
      onWorkspaceChanged: jest.fn((listener: () => void) => {
        workspaceChangedListeners.add(listener);
        return { dispose: jest.fn(() => workspaceChangedListeners.delete(listener)) };
      }),
      onWorkspaceLocationChanged: jest.fn((listener: () => void) => {
        workspaceLocationChangedListeners.add(listener);
        return { dispose: jest.fn(() => workspaceLocationChangedListeners.delete(listener)) };
      }),
      workspace: undefined as { uri: string } | undefined,
      setWorkspaceForTest(this: { workspace: { uri: string } | undefined }, workspace: { uri: string } | undefined) {
        this.workspace = workspace;
        workspaceChangedListeners.forEach((listener) => listener());
        workspaceLocationChangedListeners.forEach((listener) => listener());
      },
    },
    workspaceSwitch: {
      isTaskLaunchPending: false,
      launchTask: jest.fn(() => Promise.resolve(true)),
      onDidChangeTaskLaunchPending: jest.fn(() => disposable()),
      refreshProjectAvailability: jest.fn(() => Promise.resolve()),
      restorePendingWork: jest.fn(() => Promise.resolve()),
      seedProjectCatalog: jest.fn(() => Promise.resolve()),
    },
    getLatestChatInputProps: () => latestChatInputProps,
    getLatestQueuedEditorProps: () => latestQueuedEditorProps,
    setActiveChatInputForTest: (next: typeof activeChatInput) => {
      activeChatInput = next;
      activeInputHandle = null;
      activeInputHandleOwnerId = undefined;
    },
    ChatInputForTest,
    QueuedEditorForTest,
    mainInputFocus,
    mainInputRestoreDraft,
    mainInputSetExpanded,
    queuedEditorFocus,
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

    if (key.includes('KeybindingRegistry')) {
      return services.keybindingRegistry;
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

    if (name === 'AgenticTaskRegistryService') {
      return services.agenticTaskRegistry;
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
    const services = createMockServices({ panelLayout: 'classic' });
    installInjectableMocks(services);

    await renderHeader(
      React.createElement(DefaultChatViewHeaderACP, {
        handleClear: jest.fn(),
        handleCloseChatView: jest.fn(),
      }),
    );

    expect(container.querySelector('#ai-chat-header-maximize')).toBeNull();
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-history-new"]') as HTMLButtonElement).click();
    });
    expect(services.commandService.executeCommand).toHaveBeenCalledWith(AI_CHAT_NEW_CHAT.id);
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

    const actions = container.querySelector(
      '[data-testid="agentic-chat-panel-header"] > div:last-child',
    ) as HTMLDivElement;
    const taskLaunchButton = actions.querySelector('[data-testid="agentic-task-launch-button"]');
    expect(taskLaunchButton).not.toBeNull();
    expect(actions.children[0]?.contains(taskLaunchButton)).toBe(true);
    expect(actions.children[1]?.querySelector('#agentic-chat-panel-header-maximize')).not.toBeNull();

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

  it('preselects the active Agent in the header New Task menu', async () => {
    const services = createMockServices({
      agentConfigs: {
        'agent-a': { command: 'agent-a', description: 'Agent A' },
        'agent-b': { command: 'agent-b', description: 'Agent B' },
      },
      panelLayout: 'agentic',
      session: createMockSession(),
      chatViewHeaderRender: AcpChatViewHeader,
    });
    const currentProject = {
      availability: 'available' as const,
      id: 'project-current',
      joinedAt: 2,
      label: 'Project Current',
      workspacePath: '/work/current',
      workspaceUri: 'file:///work/current',
    };
    services.workspaceService.workspace = { uri: currentProject.workspaceUri };
    services.agenticTaskRegistry.getProject.mockResolvedValue(currentProject);
    services.agenticTaskRegistry.getTask.mockResolvedValue({ agentId: 'agent-b' });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      await flushPromises();
      await flushPromises();
    });

    const launch = container.querySelector('[data-testid="agentic-task-agent-menu-button"]') as HTMLButtonElement;
    await act(async () => {
      launch.click();
    });

    const agentBButton = container.querySelector(
      '[data-testid="agentic-task-agent-option-agent-b"]',
    ) as HTMLButtonElement;
    expect(agentBButton.getAttribute('aria-current')).toBe('true');

    await act(async () => {
      agentBButton.click();
      await Promise.resolve();
    });
    expect(services.commandService.executeCommand).toHaveBeenCalledWith(AI_CHAT_NEW_TASK.id, 'agent-b');
  });

  it('uses the active Task Project for Header New Task and displays a foreign execution context', async () => {
    const services = createMockServices({
      agentConfigs: {
        'agent-a': { command: 'agent-a', description: 'Agent A' },
        'agent-b': { command: 'agent-b', description: 'Agent B' },
      },
      panelLayout: 'agentic',
      session: createMockSession(),
      chatViewHeaderRender: AcpChatViewHeader,
    });
    const currentProject = {
      availability: 'available' as const,
      id: 'project-current',
      joinedAt: 2,
      label: 'Project Current',
      workspacePath: '/work/current',
      workspaceUri: 'file:///work/current',
    };
    const otherProject = {
      availability: 'available' as const,
      id: 'project-other',
      joinedAt: 1,
      label: 'Project Other',
      workspacePath: '/work/other',
      workspaceUri: 'file:///work/other',
    };
    services.workspaceService.workspace = { uri: currentProject.workspaceUri };
    services.agenticTaskRegistry.getTask.mockResolvedValue({
      agentId: 'agent-b',
      projectId: otherProject.id,
      sessionId: 'acp:current',
    });
    services.agenticTaskRegistry.getProject.mockImplementation((projectId: string) =>
      Promise.resolve(projectId === otherProject.id ? otherProject : currentProject),
    );
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      await flushPromises();
      await flushPromises();
    });

    const executionContext = container.querySelector('[data-testid="agentic-task-execution-context"]');
    expect(executionContext?.getAttribute('title')).toBe(otherProject.workspacePath);
    expect(executionContext?.getAttribute('aria-label')).toBe(`Agent working directory: ${otherProject.workspacePath}`);
    expect(executionContext?.textContent).toContain('Agent working directory:');
    expect(executionContext?.textContent).toContain(otherProject.label);
    expect(services.agenticTaskRegistry.getProject).toHaveBeenCalledWith(otherProject.id);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-menu-button"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-option-agent-b"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.commandService.executeCommand).toHaveBeenCalledWith(AI_CHAT_NEW_TASK.id, 'agent-b');
  });

  it('does not display an execution context when the active Task uses the IDE workspace', async () => {
    const services = createMockServices({
      panelLayout: 'agentic',
      session: createMockSession(),
      chatViewHeaderRender: AcpChatViewHeader,
    });
    const currentProject = {
      availability: 'available' as const,
      id: 'project-current',
      joinedAt: 2,
      label: 'Project Current',
      workspacePath: '/work/current',
      workspaceUri: 'file:///work/current',
    };
    services.workspaceService.workspace = { uri: currentProject.workspaceUri };
    services.agenticTaskRegistry.getTask.mockResolvedValue({
      agentId: 'agent-a',
      projectId: currentProject.id,
      sessionId: 'acp:current',
    });
    services.agenticTaskRegistry.getProject.mockResolvedValue(currentProject);
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      await flushPromises();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="agentic-task-execution-context"]')).toBeNull();
  });

  it('launches the newly active workspace from the header Agent menu', async () => {
    const services = createMockServices({
      agentConfigs: {
        'agent-a': { command: 'agent-a', description: 'Agent A' },
      },
      panelLayout: 'agentic',
      chatViewHeaderRender: AcpChatViewHeader,
    });
    const currentProject = {
      availability: 'available' as const,
      id: 'project-current',
      joinedAt: 2,
      label: 'Project Current',
      workspacePath: '/work/current',
      workspaceUri: 'file:///work/current',
    };
    const otherProject = {
      availability: 'available' as const,
      id: 'project-other',
      joinedAt: 1,
      label: 'Project Other',
      workspacePath: '/work/other',
      workspaceUri: 'file:///work/other',
    };
    services.workspaceService.workspace = { uri: currentProject.workspaceUri };
    services.agenticTaskRegistry.getProject.mockImplementation((projectId: string) =>
      Promise.resolve(projectId === otherProject.workspaceUri ? otherProject : currentProject),
    );
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      await flushPromises();
      services.workspaceService.setWorkspaceForTest({ uri: otherProject.workspaceUri });
      await flushPromises();
    });

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-menu-button"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-option-agent-a"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(services.commandService.executeCommand).toHaveBeenCalledWith(AI_CHAT_NEW_TASK.id, 'agent-a');
  });

  it('uses the current Agentic draft target before the first prompt is registered', async () => {
    const services = createMockServices({
      agentConfigs: {
        'agent-a': { command: 'agent-a', description: 'Agent A' },
        'agent-b': { command: 'agent-b', description: 'Agent B' },
      },
      defaultAgentType: 'agent-a',
      panelLayout: 'agentic',
      session: null,
      sessions: [],
      chatViewHeaderRender: AcpChatViewHeader,
    });
    const currentProject = {
      availability: 'available' as const,
      id: 'project-current',
      joinedAt: 2,
      label: 'Project Current',
      workspacePath: '/work/current',
      workspaceUri: 'file:///work/current',
    };
    services.workspaceService.workspace = { uri: currentProject.workspaceUri };
    services.agenticTaskRegistry.getProject.mockResolvedValue(currentProject);
    services.aiChatService.getActiveAgenticTaskAgentId.mockReturnValue('agent-b');
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      await flushPromises();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-menu-button"]') as HTMLButtonElement).click();
    });
    const agentBButton = container.querySelector(
      '[data-testid="agentic-task-agent-option-agent-b"]',
    ) as HTMLButtonElement;
    expect(agentBButton.getAttribute('aria-current')).toBe('true');
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
      response: createRequestResponse(),
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

  it('does not promote a different service session when the initial ensure returns an older session', async () => {
    const ensuredSession = createMockSession({ messages: [], sessionId: 'acp:ensured' });
    const replacementSession = createMockSession({ messages: [], sessionId: 'acp:replacement' });
    const deferredEnsure = createDeferred<typeof ensuredSession>();
    const ensureSessionModel = jest.fn(() => deferredEnsure.promise);
    const createRequest = jest.fn();
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      ensureSessionModel,
      sendRequest,
      session: null,
      sessions: [],
    });
    services.aiChatService.ensureSessionModel.mockImplementation(async () => {
      const sessionModel = await ensureSessionModel();
      services.aiChatService.sessionModel = replacementSession;
      return sessionModel;
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    let sendResult!: Promise<boolean>;
    await act(async () => {
      sendResult = services.getLatestChatInputProps().onSend('hello');
      await Promise.resolve();
    });
    expect(ensureSessionModel).toHaveBeenCalledTimes(1);

    let accepted!: boolean;
    await act(async () => {
      deferredEnsure.resolve(ensuredSession);
      accepted = await sendResult;
      await flushPromises();
    });

    expect(accepted).toBe(false);
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
    expect(ensuredSession.history.addUserMessage).not.toHaveBeenCalled();
    expect(ensuredSession.history.addAssistantMessage).not.toHaveBeenCalled();
    expect(replacementSession.history.addUserMessage).not.toHaveBeenCalled();
    expect(replacementSession.history.addAssistantMessage).not.toHaveBeenCalled();
    expect(services.aiChatService.sessionModel).toBe(replacementSession);
  });

  it('renders ACP replies with Deep Thinking collapsed by default', async () => {
    const session = createMockSession({ messages: [] });
    const createRequest = jest.fn(() => ({
      message: {
        agentId: 'default-agent',
        prompt: 'hello',
      },
      requestId: 'request-1',
      response: createRequestResponse(),
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

  it('passes queued turn actions to the active input and registers its handle with the contribution owner', async () => {
    const services = createMockServices();
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));

    expect(services.getLatestChatInputProps().turnActions).toEqual(
      expect.objectContaining({
        submit: expect.any(Function),
        stop: expect.any(Function),
        fastTrack: expect.any(Function),
        invalidateFastTrack: expect.any(Function),
        takeBackLastQueuedTurn: expect.any(Function),
      }),
    );
    expect(services.chatInputRegistry.setActiveInputHandle).toHaveBeenCalledWith(expect.any(Object), 'test-input');

    await act(async () => {
      root.render(React.createElement('div'));
      await Promise.resolve();
    });

    expect(services.chatInputRegistry.setActiveInputHandle).toHaveBeenLastCalledWith(null, 'test-input');
  });

  it('keeps the replacement contribution handle when the old contribution reports delayed cleanup', async () => {
    const session = createMockSession({ messages: [] });
    session.threadStatus = 'working';
    const services = createMockServices({ session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    const oldReady = services.getLatestChatInputProps().onInputHandleReady;

    services.setActiveChatInputForTest({
      id: 'replacement-input',
      component: services.ChatInputForTest,
      capabilities: ['rich-queued-edit'],
      queuedTurnEditor: services.QueuedEditorForTest,
    });
    await renderHeader(React.createElement(AIChatViewACPContent));

    act(() => oldReady(null));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    act(() => services.getLatestChatInputProps().turnActions.takeBackLastQueuedTurn());

    expect(services.chatInputRegistry.getActiveInputHandle()).not.toBeNull();
    expect(services.mainInputFocus).not.toHaveBeenCalled();
  });

  it('uses capabilities and queued editor from the same active input contribution', async () => {
    const session = createMockSession({ messages: [] });
    session.threadStatus = 'working';
    const services = createMockServices({
      activeInputCapabilities: ['focus'],
      session,
      withQueuedEditor: false,
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="acp-queued-turns-summary"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-queued-turn-edit"]')).toBeNull();
  });

  it('focuses the current queued editor when another Queued Turn edit is rejected', async () => {
    const session = createMockSession({ messages: [] });
    session.threadStatus = 'working';
    const services = createMockServices({ session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="acp-chat-send-later-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelectorAll('[data-testid="acp-queued-turn-edit"]')[0] as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="test-queued-editor"]')).not.toBeNull();
    expect((container.querySelector('[data-testid="acp-queued-turns-summary"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(services.queuedEditorFocus).toHaveBeenCalledTimes(1);

    services.queuedEditorFocus.mockClear();
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-edit"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(services.queuedEditorFocus).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="test-queued-editor"]')).not.toBeNull();
  });

  it('focuses the first mounted queued contenteditable after the Edit button is replaced', async () => {
    const session = createMockSession({ messages: [] });
    session.threadStatus = 'working';
    const services = createMockServices({ session });
    const ContenteditableQueuedEditor = (props: any) => {
      const editorRef = React.useRef<HTMLDivElement>(null);
      React.useEffect(() => {
        props.onReady?.({ focus: () => editorRef.current?.focus() });
        return () => props.onReady?.(null);
      }, [props.onReady]);
      return React.createElement('div', {
        'data-testid': 'actual-queued-contenteditable',
        contentEditable: true,
        ref: editorRef,
        suppressContentEditableWarning: true,
      });
    };
    services.setActiveChatInputForTest({
      id: 'actual-queued-editor-input',
      component: services.ChatInputForTest,
      capabilities: ['rich-queued-edit'],
      queuedTurnEditor: ContenteditableQueuedEditor,
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    const editButton = container.querySelector('[data-testid="acp-queued-turn-edit"]') as HTMLButtonElement;
    editButton.focus();

    await act(async () => {
      editButton.click();
      await flushPromises();
    });

    const editor = container.querySelector('[data-testid="actual-queued-contenteditable"]') as HTMLDivElement;
    expect(editor).not.toBeNull();
    expect(document.activeElement).toBe(editor);
  });

  it('keeps the replacement queued editor handle when the old editor reports delayed cleanup', async () => {
    const session = createMockSession({ messages: [] });
    session.threadStatus = 'working';
    const services = createMockServices({ session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="acp-chat-send-later-followup"]') as HTMLButtonElement).click();
      services.getLatestChatInputProps().onSend('third follow up');
      await flushPromises();
    });
    await act(async () => {
      (container.querySelectorAll('[data-testid="acp-queued-turn-edit"]')[0] as HTMLButtonElement).click();
      await Promise.resolve();
    });
    const oldReady = services.getLatestQueuedEditorProps().onReady;

    await act(async () => {
      (container.querySelector('[data-testid="test-queued-editor-cancel"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelectorAll('[data-testid="acp-queued-turn-edit"]')[1] as HTMLButtonElement).click();
      await Promise.resolve();
    });
    services.queuedEditorFocus.mockClear();
    act(() => oldReady(null));
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-edit"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(services.queuedEditorFocus).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="test-queued-editor"]')).not.toBeNull();
  });

  it('restores main input focus after edit save, cancel, delete, and clear only', async () => {
    const session = createMockSession({ messages: [] });
    const services = createMockServices({ session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.mainInputFocus).not.toHaveBeenCalled();

    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turns-summary"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="acp-queued-turns-summary"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(services.mainInputFocus).not.toHaveBeenCalled();

    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-edit"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="test-queued-editor-save"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.mainInputFocus).toHaveBeenCalledTimes(1);

    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-edit"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="test-queued-editor-cancel"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.mainInputFocus).toHaveBeenCalledTimes(2);

    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-delete"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.mainInputFocus).toHaveBeenCalledTimes(3);

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.mainInputFocus).toHaveBeenCalledTimes(3);

    act(() => {
      services.getLatestChatInputProps().turnActions.takeBackLastQueuedTurn();
    });
    expect(services.mainInputFocus).toHaveBeenCalledTimes(3);

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[aria-label="Clear queued turns"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(services.mainInputFocus).toHaveBeenCalledTimes(4);
  });

  it('keeps the queued editor open and does not focus main input when an invalid save is rejected', async () => {
    const session = createMockSession({ messages: [] });
    session.threadStatus = 'working';
    const services = createMockServices({ session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-edit"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    await act(async () => {
      await services.getLatestQueuedEditorProps().onSave({ message: '   ', images: [] });
      await flushPromises();
    });

    expect(services.mainInputFocus).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="test-queued-editor"]')).not.toBeNull();
  });

  it('focuses main input only after Immediate Send settles and not after automatic advancement', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const services = createMockServices({ createRequest, session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      session.threadStatus = 'working';
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-immediate"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(services.mainInputFocus).not.toHaveBeenCalled();

    await act(async () => {
      responses[0].finish('manual-stop');
      await flushPromises();
    });
    expect(services.mainInputFocus).toHaveBeenCalledTimes(1);

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-later-followup"]') as HTMLButtonElement).click();
      await flushPromises();
      responses[1].finish('completed');
      await flushPromises();
    });
    expect(services.mainInputFocus).toHaveBeenCalledTimes(1);
  });

  it('does not focus the new Active Session when an old Immediate Send settles', async () => {
    const firstSession = createMockSession({ messages: [], sessionId: 'acp:first' });
    const secondSession = createMockSession({ messages: [], sessionId: 'acp:second' });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const services = createMockServices({
      createRequest,
      session: firstSession,
      sessions: [firstSession, secondSession],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      firstSession.threadStatus = 'working';
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-immediate"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    services.aiChatService.sessionModel = secondSession;
    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      responses[0].finish('manual-stop');
      await flushPromises();
    });

    expect(services.mainInputFocus).not.toHaveBeenCalled();
  });

  it('does not focus after the service switches Active Session before queued effects flush', async () => {
    const firstSession = createMockSession({ messages: [], sessionId: 'acp:first' });
    const secondSession = createMockSession({ messages: [], sessionId: 'acp:second' });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const services = createMockServices({
      createRequest,
      session: firstSession,
      sessions: [firstSession, secondSession],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      firstSession.threadStatus = 'working';
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-immediate"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    services.aiChatService.sessionModel = secondSession;
    await act(async () => {
      responses[0].finish('manual-stop');
      await flushPromises();
    });

    expect(services.mainInputFocus).not.toHaveBeenCalled();
  });

  it('does not focus after the view unmounts before an Immediate Send settles', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const services = createMockServices({ createRequest, session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      session.threadStatus = 'working';
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-immediate"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    act(() => root.render(React.createElement('div')));
    await act(async () => {
      responses[0].finish('manual-stop');
      await flushPromises();
    });

    expect(services.mainInputFocus).not.toHaveBeenCalled();
  });

  it('keeps a manual collapse sticky within one Active Session and resets it on activation', async () => {
    const firstSession = createMockSession({ messages: [], sessionId: 'acp:first' });
    firstSession.threadStatus = 'working';
    const secondSession = createMockSession({ messages: [], sessionId: 'acp:second' });
    secondSession.threadStatus = 'working';
    const services = createMockServices({ session: firstSession, sessions: [firstSession, secondSession] });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turns-summary"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-later-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    services.aiChatService.sessionModel = createMockSession({
      messages: [
        {
          role: ChatMessageRole.User,
          content: 'replacement history',
        },
      ],
      sessionId: 'acp:first',
    });
    services.aiChatService.sessionModel.threadStatus = 'working';
    await renderHeader(React.createElement(AIChatViewACPContent));

    const createMessageByUser = jest.requireMock('../../src/browser/components/utils').createMessageByUser as jest.Mock;
    expect(createMessageByUser.mock.calls.map(([message]) => message.text?.props?.text)).toContain(
      'replacement history',
    );
    expect(container.querySelector('[data-testid="acp-queued-turn-preview"]')).toBeNull();

    services.aiChatService.sessionModel = secondSession;
    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="acp-queued-turn-preview"]')?.textContent).toContain('follow up');
  });

  it('collapses the main input on Active Session change without clearing its draft or moving focus', async () => {
    const firstSession = createMockSession({ messages: [], sessionId: 'acp:first' });
    const secondSession = createMockSession({ messages: [], sessionId: 'acp:second' });
    const services = createMockServices({ session: firstSession, sessions: [firstSession, secondSession] });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    services.mainInputSetExpanded.mockClear();
    services.mainInputRestoreDraft.mockClear();
    services.mainInputFocus.mockClear();

    services.aiChatService.sessionModel = secondSession;
    await renderHeader(React.createElement(AIChatViewACPContent));

    expect(services.mainInputSetExpanded).toHaveBeenCalledWith(false);
    expect(services.mainInputRestoreDraft).not.toHaveBeenCalled();
    expect(services.mainInputFocus).not.toHaveBeenCalled();
  });

  it('queues follow-up ACP messages while a reply is loading and sends them after the reply completes', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest
      .fn()
      .mockImplementation((message: string, agentId: string, images?: string[], command?: string) => {
        const response = createRequestResponse();
        responses.push(response);
        return {
          message: {
            agentId,
            command,
            images,
            prompt: message,
          },
          requestId: `request-${responses.length}`,
          response,
        };
      });
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
    expect(container.querySelector('[data-testid="acp-queued-turns-summary"]')?.textContent).toContain('1 Queued Turn');
    expect(container.querySelector('[data-testid="acp-queued-turn-preview"]')?.textContent).toContain('follow up');

    await act(async () => {
      responses[0].finish('completed');
      await flushPromises();
    });

    expect(createRequest).toHaveBeenNthCalledWith(2, 'follow up', 'default-agent', undefined, undefined);
    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="acp-queued-turns-summary"]')).toBeNull();
  });

  it('awaiting_prompt 状态下直接发送下一条消息，不进入排队列表', async () => {
    const session = createMockSession({ messages: [] });
    session.threadStatus = 'awaiting_prompt';
    const response = createRequestResponse();
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => ({
      message: { agentId, command, images, prompt: message },
      requestId: 'request-1',
      response,
    }));
    const sendRequest = jest.fn();
    const services = createMockServices({ createRequest, sendRequest, session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    expect(services.getLatestChatInputProps().loading).toBe(false);

    let accepted = false;
    await act(async () => {
      accepted = await services.getLatestChatInputProps().onSend('下一条消息');
      await flushPromises();
    });

    expect(accepted).toBe(true);
    expect(createRequest).toHaveBeenCalledWith('下一条消息', 'default-agent', undefined, undefined);
    expect(sendRequest).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="acp-queued-turns-summary"]')).toBeNull();
  });

  it('completes the response as agent-error when sendRequest throws synchronously', async () => {
    const session = createMockSession({ messages: [] });
    const response = createRequestResponse();
    const createRequest = jest.fn(() => ({
      message: { agentId: 'default-agent', prompt: 'hello' },
      requestId: 'request-1',
      response,
    }));
    const sendRequest = jest.fn(() => {
      throw new Error('sync kickoff failed');
    });
    const services = createMockServices({ createRequest, sendRequest, session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(response.errorDetails).toEqual({ message: 'sync kickoff failed' });
    expect(response.isComplete).toBe(true);
    expect(response.listenerCount).toBe(0);
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
  });

  it('completes the response as agent-error when sendRequest returns a rejected promise', async () => {
    const session = createMockSession({ messages: [] });
    const response = createRequestResponse();
    const createRequest = jest.fn(() => ({
      message: { agentId: 'default-agent', prompt: 'hello' },
      requestId: 'request-1',
      response,
    }));
    const rejection = Promise.reject(new Error('async kickoff failed'));
    void rejection.catch(() => undefined);
    const sendRequest = jest.fn(() => rejection);
    const services = createMockServices({ createRequest, sendRequest, session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(response.errorDetails).toEqual({ message: 'async kickoff failed' });
    expect(response.isComplete).toBe(true);
    expect(response.listenerCount).toBe(0);
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
  });

  it('keeps queued turn snapshots and FIFO advancement active after StrictMode effect replay', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      ensureSessionModel: jest.fn(async () => session),
      sendRequest,
      session: null,
      sessions: [],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(React.StrictMode, null, React.createElement(AIChatViewACPContent)));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="acp-queued-turns-summary"]')?.textContent).toContain('1 Queued Turn');

    await act(async () => {
      responses[0].finish('completed');
      await flushPromises();
    });

    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="acp-queued-turns-summary"]')).toBeNull();
  });

  it('detaches active response listeners on unmount and ignores later completion', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
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
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(responses[0].listenerCount).toBe(1);

    await renderHeader(React.createElement('div'));

    expect(responses[0].listenerCount).toBe(0);
    await act(async () => {
      responses[0].finish('completed');
      await flushPromises();
    });

    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(sendRequest).toHaveBeenCalledTimes(1);
  });

  it('does not continue an initial send after unmount while ensuring its session', async () => {
    const ensuredSession = createMockSession({ messages: [], sessionId: 'acp:ensured' });
    const deferredEnsure = createDeferred<typeof ensuredSession>();
    const ensureSessionModel = jest.fn(() => deferredEnsure.promise);
    const createRequest = jest.fn();
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
    let sendResult!: Promise<boolean>;
    await act(async () => {
      sendResult = services.getLatestChatInputProps().onSend('hello');
      await Promise.resolve();
    });
    expect(ensureSessionModel).toHaveBeenCalledTimes(1);

    await renderHeader(React.createElement('div'));
    const handleCallbackCountAfterUnmount = services.chatInputRegistry.setActiveInputHandle.mock.calls.length;

    let accepted!: boolean;
    await act(async () => {
      deferredEnsure.resolve(ensuredSession);
      accepted = await sendResult;
      await flushPromises();
    });

    expect(accepted).toBe(false);
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
    expect(ensuredSession.history.addUserMessage).not.toHaveBeenCalled();
    expect(ensuredSession.history.addAssistantMessage).not.toHaveBeenCalled();
    expect(services.chatInputRegistry.setActiveInputHandle).toHaveBeenCalledTimes(handleCallbackCountAfterUnmount);
  });

  it('does not continue a Mention send after unmount while resolving its context', async () => {
    const session = createMockSession({ messages: [] });
    const deferredRelativePath = createDeferred<undefined>();
    const createRequest = jest.fn();
    const sendRequest = jest.fn();
    const services = createMockServices({ createRequest, sendRequest, session });
    services.workspaceService.asRelativePath.mockImplementationOnce(() => deferredRelativePath.promise);
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    let sendResult!: Promise<boolean>;
    await act(async () => {
      sendResult = services.getLatestChatInputProps().onSend('{{@file:/workspace/file.ts}} hello');
      await Promise.resolve();
    });
    expect(services.workspaceService.asRelativePath).toHaveBeenCalledTimes(1);

    await renderHeader(React.createElement('div'));
    const handleCallbackCountAfterUnmount = services.chatInputRegistry.setActiveInputHandle.mock.calls.length;

    let accepted!: boolean;
    await act(async () => {
      deferredRelativePath.resolve(undefined);
      accepted = await sendResult;
      await flushPromises();
    });

    expect(accepted).toBe(false);
    expect(services.aiChatService.ensureSessionModel).not.toHaveBeenCalled();
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
    expect(session.history.addUserMessage).not.toHaveBeenCalled();
    expect(session.history.addAssistantMessage).not.toHaveBeenCalled();
    expect(services.chatInputRegistry.setActiveInputHandle).toHaveBeenCalledTimes(handleCallbackCountAfterUnmount);
  });

  it('pauses queued turns after manual stop and resumes only the original FIFO head', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
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
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="acp-chat-send-later-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(sendRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-stop"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
    expect(sendRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      responses[0].finish('manual-stop');
      await flushPromises();
      (container.querySelector('[data-testid="acp-queued-turn-resume"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(createRequest).toHaveBeenNthCalledWith(2, 'follow up', 'default-agent', undefined, undefined);
    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('[data-testid="acp-queued-turn-preview"]')[0]?.textContent).toContain(
      'later follow up',
    );
  });

  it('keeps one production-owned copy after start failure and does not resend from the real contenteditable', async () => {
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState({}, '', '/?aiNative=true&acpBddQueuedTurnStartFailure=reject-once');
    const session = createMockSession({ messages: [] });
    const createRequest = jest.fn(() => ({
      message: { agentId: 'default-agent', prompt: 'start failure draft' },
      requestId: 'request-1',
      response: createRequestResponse(),
    }));
    const sendRequest = jest.fn();
    const services = createMockServices({ createRequest, sendRequest, session });
    const ContenteditableInput = React.forwardRef((props: any, _ref) => {
      const editorRef = React.useRef<HTMLDivElement>(null);
      React.useEffect(() => {
        props.onInputHandleReady?.({
          focus: () => editorRef.current?.focus(),
          restoreDraft: (draft: { message: string }) => {
            editorRef.current?.replaceChildren(document.createTextNode(draft.message));
          },
          setExpanded: jest.fn(),
        });
        return () => props.onInputHandleReady?.(null);
      }, [props.onInputHandleReady]);
      return React.createElement('div', {
        'data-testid': 'production-main-contenteditable',
        contentEditable: true,
        onKeyDown: async (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          const message = editorRef.current?.textContent || '';
          if (!message) {
            await props.turnActions.fastTrack();
            return;
          }
          const result = await props.turnActions.submit({ message }, 'normal');
          if (result.accepted || result.draftDisposition === 'queued') {
            editorRef.current?.replaceChildren();
          }
        },
        ref: editorRef,
        suppressContentEditableWarning: true,
      });
    });
    services.setActiveChatInputForTest({
      id: 'production-contenteditable-input',
      component: ContenteditableInput,
      capabilities: ['focus', 'restore-draft'],
      queuedTurnEditor: undefined,
    });
    installInjectableMocks(services);

    try {
      await renderHeader(React.createElement(AIChatViewACPContent));
      const editor = container.querySelector('[data-testid="production-main-contenteditable"]') as HTMLDivElement;
      editor.textContent = 'start failure draft';
      await act(async () => {
        editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
        await flushPromises();
      });

      expect(createRequest).not.toHaveBeenCalled();
      expect(editor.textContent).toBe('');
      expect(container.querySelector('[data-testid="acp-queued-turn-preview"]')?.textContent).toContain(
        'start failure draft',
      );
      expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');

      await act(async () => {
        (container.querySelector('[data-testid="acp-queued-turn-resume"]') as HTMLButtonElement).click();
        await flushPromises();
      });
      expect(createRequest).toHaveBeenCalledTimes(1);
      expect(sendRequest).toHaveBeenCalledTimes(1);

      await act(async () => {
        editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
        await flushPromises();
      });
      expect(createRequest).toHaveBeenCalledTimes(1);
      expect(sendRequest).toHaveBeenCalledTimes(1);
    } finally {
      window.history.pushState({}, '', originalUrl);
    }
  });

  it.each([
    { failure: 'corrective cancellation fails', replacementStartFails: false },
    { failure: 'corrective replacement start fails', replacementStartFails: true },
  ])('keeps one production-owned corrective copy when $failure', async ({ replacementStartFails }) => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    let failedCorrectiveStart = false;
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      if (replacementStartFails && message === 'corrective draft' && !failedCorrectiveStart) {
        failedCorrectiveStart = true;
        throw new Error('corrective start failed');
      }
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const sendRequest = jest.fn();
    const services = createMockServices({ createRequest, sendRequest, session });
    let contenteditableProps: any;
    const ContenteditableInput = React.forwardRef((props: any, _ref) => {
      contenteditableProps = props;
      const editorRef = React.useRef<HTMLDivElement>(null);
      React.useEffect(() => {
        props.onInputHandleReady?.({
          focus: () => editorRef.current?.focus(),
          restoreDraft: (draft: { message: string }) => {
            editorRef.current?.replaceChildren(document.createTextNode(draft.message));
          },
          setExpanded: jest.fn(),
        });
        return () => props.onInputHandleReady?.(null);
      }, [props.onInputHandleReady]);
      return React.createElement('div', {
        'data-testid': 'production-corrective-contenteditable',
        contentEditable: true,
        onKeyDown: async (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          const message = editorRef.current?.textContent || '';
          if (!message) {
            await props.turnActions.fastTrack();
            return;
          }
          const result = await props.turnActions.submit({ message }, 'normal');
          if (result.accepted || result.draftDisposition === 'queued') {
            editorRef.current?.replaceChildren();
          }
        },
        ref: editorRef,
        suppressContentEditableWarning: true,
      });
    });
    services.setActiveChatInputForTest({
      id: 'production-corrective-contenteditable-input',
      component: ContenteditableInput,
      capabilities: ['focus', 'restore-draft'],
      queuedTurnEditor: undefined,
    });
    services.aiChatService.cancelRequest
      .mockRejectedValueOnce(new Error('stop cancel failed'))
      .mockImplementationOnce(() => {
        if (replacementStartFails) {
          responses[0].finish('manual-stop');
          return undefined;
        }
        return Promise.reject(new Error('corrective cancel failed'));
      });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    const editor = container.querySelector('[data-testid="production-corrective-contenteditable"]') as HTMLDivElement;
    editor.textContent = 'running';
    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      await flushPromises();
    });
    expect(sendRequest).toHaveBeenCalledTimes(1);
    session.threadStatus = 'working';

    await act(async () => {
      await contenteditableProps.turnActions.stop();
      await flushPromises();
    });
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');

    editor.textContent = 'corrective draft';
    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      await flushPromises();
    });

    expect(editor.textContent).toBe('');
    expect(container.querySelectorAll('[data-testid="acp-queued-turn-preview"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="acp-queued-turn-preview"]')?.textContent).toContain(
      'corrective draft',
    );
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');

    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-resume"]') as HTMLButtonElement).click();
      if (!replacementStartFails) {
        responses[0].finish('completed');
      }
      await flushPromises();
    });

    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(sendRequest.mock.calls[1][0].message.prompt).toBe('corrective draft');

    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      await flushPromises();
    });
    expect(sendRequest).toHaveBeenCalledTimes(2);
  });

  it('waits for the matching response cancellation before Immediate Send starts another request', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
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
      session.threadStatus = 'working';
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    const sendNow = container.querySelector('[data-testid="acp-queued-turn-immediate"]');
    await act(async () => {
      (sendNow as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.aiChatService.cancelRequest).toHaveBeenCalledTimes(1);
    expect(sendRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      responses[0].finish('manual-stop');
      await flushPromises();
    });

    expect(createRequest).toHaveBeenNthCalledWith(2, 'follow up', 'default-agent', undefined, undefined);
    expect(sendRequest).toHaveBeenCalledTimes(2);
  });

  it('keeps the Immediate Send at the FIFO head when an active response cannot be cancelled', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const sendRequest = jest.fn();
    const services = createMockServices({ createRequest, sendRequest, session });
    services.aiChatService.cancelRequest.mockRejectedValue(new Error('active cancellation failed'));
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      session.threadStatus = 'working';
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="acp-chat-send-later-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-immediate"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.aiChatService.cancelRequest).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(sendRequest).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Could not stop');
    expect(
      Array.from(container.querySelectorAll('[data-testid="acp-queued-turn-preview"]')).map((item) => item.textContent),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining('follow up'), expect.stringContaining('later follow up')]),
    );
    expect(container.querySelectorAll('[data-testid="acp-queued-turn-preview"]')[0]?.textContent).toContain(
      'follow up',
    );
  });

  it('starts an idle main-input Immediate Send without calling the production cancellation adapter', async () => {
    const session = createMockSession({ messages: [] });
    const createRequest = jest.fn(() => ({
      message: { agentId: 'default-agent', prompt: 'idle immediate' },
      requestId: 'request-1',
      response: createRequestResponse(),
    }));
    const sendRequest = jest.fn();
    const services = createMockServices({ createRequest, sendRequest, session });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-immediate"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.aiChatService.cancelRequest).not.toHaveBeenCalled();
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(sendRequest).toHaveBeenCalledTimes(1);
  });

  it('Immediately Sends a retained production queue when Stop leaves only stale response bookkeeping', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const sendRequest = jest.fn();
    const services = createMockServices({ createRequest, sendRequest, session });
    let rejectStoppedCancellation!: (error: Error) => void;
    services.aiChatService.cancelRequest.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectStoppedCancellation = reject;
        }),
    );
    let productionInputProps: any;
    const ProductionLikeInput = React.forwardRef((props: any, _ref) => {
      productionInputProps = props;
      React.useEffect(() => {
        props.onInputHandleReady?.({ focus: jest.fn(), restoreDraft: jest.fn(), setExpanded: jest.fn() });
        return () => props.onInputHandleReady?.(null);
      }, [props.onInputHandleReady]);
      return React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          { 'data-testid': 'acp-chat-send', onClick: () => props.onSend('running'), type: 'button' },
          'send',
        ),
        React.createElement(
          'button',
          { 'data-testid': 'acp-chat-send-followup', onClick: () => props.onSend('selected'), type: 'button' },
          'send selected',
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'acp-chat-send-later-followup',
            onClick: () => props.onSend('tail'),
            type: 'button',
          },
          'send tail',
        ),
        props.loading
          ? React.createElement(
              'button',
              { 'data-testid': 'acp-chat-stop', onClick: () => props.turnActions.stop(), type: 'button' },
              'stop',
            )
          : null,
      );
    });
    services.setActiveChatInputForTest({
      id: 'production-like-stopped-input',
      component: ProductionLikeInput,
      capabilities: ['focus', 'restore-draft'],
      queuedTurnEditor: undefined,
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    let stoppedResult: Promise<unknown>;
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      session.threadStatus = 'working';
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="acp-chat-send-later-followup"]') as HTMLButtonElement).click();
      await flushPromises();
      stoppedResult = productionInputProps.turnActions.stop();
      await flushPromises();
    });

    const idleReplacement = createMockSession({ messages: [], sessionId: session.sessionId });
    services.aiChatService.sessionModel = idleReplacement;
    await renderHeader(React.createElement(AIChatViewACPContent));

    expect(idleReplacement.threadStatus).toBe('idle');
    expect(responses[0].listenerCount).toBe(1);
    expect(container.querySelector('[data-testid="acp-chat-stop"]')).toBeNull();
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Stopped');
    expect(container.querySelectorAll('[data-testid="acp-queued-turn-preview"]')).toHaveLength(2);

    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-immediate"]') as HTMLButtonElement).click();
      rejectStoppedCancellation(new Error('The stopped response was already retired.'));
      await flushPromises();
    });

    await expect(stoppedResult!).resolves.toEqual({ accepted: true, outcome: 'stopped' });
    expect(services.aiChatService.cancelRequest).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledTimes(2);
    expect(createRequest).toHaveBeenNthCalledWith(2, 'selected', 'default-agent', undefined, undefined);
    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent || '').not.toContain(
      'Could not stop',
    );
    expect(container.querySelectorAll('[data-testid="acp-queued-turn-preview"]')[0]?.textContent).toContain('tail');

    await act(async () => {
      responses[0].finish('manual-stop');
      await flushPromises();
    });

    expect(createRequest).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="acp-chat-stop"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="acp-queued-turn-preview"]')[0]?.textContent).toContain('tail');

    idleReplacement.threadStatus = 'working';
    services.aiChatService.cancelRequest.mockImplementationOnce(() => {
      responses[1].finish('manual-stop');
    });
    let selectedStopResult: any;
    await act(async () => {
      selectedStopResult = await productionInputProps.turnActions.stop();
      await flushPromises();
    });
    expect(selectedStopResult).toEqual({
      accepted: true,
      outcome: 'stopped',
    });
    expect(services.aiChatService.cancelRequest).toHaveBeenCalledTimes(2);

    await act(async () => {
      (container.querySelector('[data-testid="acp-queued-turn-resume"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(createRequest).toHaveBeenCalledTimes(3);
    expect(createRequest).toHaveBeenNthCalledWith(3, 'tail', 'default-agent', undefined, undefined);
  });

  it.each(['manual-stop', 'agent-error'] as const)(
    'Immediately Sends a retained production queue after %s without another cancellation',
    async (outcome) => {
      const session = createMockSession({ messages: [] });
      const responses: ReturnType<typeof createRequestResponse>[] = [];
      const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
        const response = createRequestResponse();
        responses.push(response);
        return {
          message: { agentId, command, images, prompt: message },
          requestId: `request-${responses.length}`,
          response,
        };
      });
      const sendRequest = jest.fn();
      const services = createMockServices({ createRequest, sendRequest, session });
      installInjectableMocks(services);

      await renderHeader(React.createElement(AIChatViewACPContent));
      await act(async () => {
        (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
        await flushPromises();
        (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
        await flushPromises();
        responses[0].finish(outcome);
        await flushPromises();
      });

      expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
      await act(async () => {
        (container.querySelector('[data-testid="acp-queued-turn-immediate"]') as HTMLButtonElement).click();
        await flushPromises();
      });

      expect(services.aiChatService.cancelRequest).not.toHaveBeenCalled();
      expect(createRequest).toHaveBeenCalledTimes(2);
      expect(sendRequest).toHaveBeenCalledTimes(2);
    },
  );

  it('cancels the current external session without letting an old observer affect its replacement', async () => {
    const firstSession = createMockSession({ messages: [], sessionId: 'acp:first' });
    const secondSession = createMockSession({ messages: [], sessionId: 'acp:second' });
    secondSession.threadStatus = 'working';
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      sendRequest,
      session: firstSession,
      sessions: [firstSession, secondSession],
    });
    services.aiChatService.cancelRequest.mockImplementation(() => {
      secondSession.threadStatus = 'idle';
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    services.aiChatService.sessionModel = secondSession;
    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    const sendNow = container.querySelector('[data-testid="acp-queued-turn-immediate"]');
    await act(async () => {
      (sendNow as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.aiChatService.cancelRequest).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledTimes(2);
    expect(createRequest).toHaveBeenNthCalledWith(2, 'follow up', 'default-agent', undefined, undefined);
    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(responses[0].listenerCount).toBe(1);
    expect(responses[1].listenerCount).toBe(1);

    await act(async () => {
      responses[0].finish('completed');
      await flushPromises();
    });

    expect(createRequest).toHaveBeenCalledTimes(2);
    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(responses[1].listenerCount).toBe(1);
    expect(services.getLatestChatInputProps().loading).toBe(true);
  });

  it('stops a remounted external generating session without requiring a tracked response observer', async () => {
    const session = createMockSession({ messages: [] });
    session.threadStatus = 'working';
    const hostResponse = createRequestResponse();
    const createRequest = jest.fn();
    const sendRequest = jest.fn();
    const services = createMockServices({ createRequest, sendRequest, session });
    services.aiChatService.cancelRequest.mockImplementation(() => {
      hostResponse.finish('manual-stop');
      session.threadStatus = 'idle';
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    let stopResult: any;
    await act(async () => {
      stopResult = await services.getLatestChatInputProps().turnActions.stop();
      await flushPromises();
    });

    expect(stopResult).toEqual({ accepted: true, outcome: 'stopped' });
    expect(services.aiChatService.cancelRequest).toHaveBeenCalledTimes(1);
    expect(hostResponse.isComplete).toBe(true);
    expect(hostResponse.isCanceled).toBe(true);
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
    expect(container.querySelector('[data-testid="acp-queued-turn-status"]')?.textContent || '').not.toContain(
      'Could not stop',
    );
  });

  it('does not advance an old session queue when its stale response completes after an Active Session switch', async () => {
    const firstSession = createMockSession({ messages: [], sessionId: 'acp:first' });
    const secondSession = createMockSession({ messages: [], sessionId: 'acp:second' });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      ensureSessionModel: jest.fn(async () => firstSession),
      sendRequest,
      session: firstSession,
      sessions: [firstSession, secondSession],
    });
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    services.aiChatService.sessionModel = secondSession;
    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      responses[0].finish('completed');
      await flushPromises();
    });

    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(sendRequest).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="acp-queued-turns-summary"]')).toBeNull();
  });

  it('rejects an old queued turn before request side effects when the service session changes without rerendering', async () => {
    const firstSession = createMockSession({ messages: [], sessionId: 'acp:first' });
    const secondSession = createMockSession({ messages: [], sessionId: 'acp:second' });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const sendRequest = jest.fn();
    const services = createMockServices({
      createRequest,
      sendRequest,
      session: firstSession,
      sessions: [firstSession, secondSession],
    });
    services.aiChatService.ensureSessionModel.mockImplementation(async () => services.aiChatService.sessionModel);
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      (container.querySelector('[data-testid="acp-chat-send-followup"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    services.aiChatService.sessionModel = secondSession;
    await act(async () => {
      responses[0].finish('completed');
      await flushPromises();
    });

    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(sendRequest).toHaveBeenCalledTimes(1);
    expect(secondSession.history.addUserMessage).not.toHaveBeenCalled();
    expect(secondSession.history.addAssistantMessage).not.toHaveBeenCalled();
  });

  it('rechecks the queued turn session after Mention expansion before creating a request', async () => {
    const firstSession = createMockSession({ messages: [], sessionId: 'acp:first' });
    const secondSession = createMockSession({ messages: [], sessionId: 'acp:second' });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
    const services = createMockServices({
      createRequest,
      session: firstSession,
      sessions: [firstSession, secondSession],
    });
    let resolveRelativePath!: (value: undefined) => void;
    services.workspaceService.asRelativePath.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolveRelativePath = resolve;
        }),
    );
    installInjectableMocks(services);

    await renderHeader(React.createElement(AIChatViewACPContent));
    await act(async () => {
      (container.querySelector('[data-testid="acp-chat-send"]') as HTMLButtonElement).click();
      await flushPromises();
      await services.getLatestChatInputProps().onSend('{{@file:/workspace/file.ts}} follow up');
      await flushPromises();
    });

    await act(async () => {
      responses[0].finish('completed');
      await Promise.resolve();
    });
    expect(services.workspaceService.asRelativePath).toHaveBeenCalledTimes(1);

    services.aiChatService.sessionModel = secondSession;
    await act(async () => {
      resolveRelativePath(undefined);
      await flushPromises();
    });

    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(services.aiChatService.sendRequest).toHaveBeenCalledTimes(1);
  });

  it('reads the current Active Session Model and config when a queued draft is actually delivered', async () => {
    const session = createMockSession({ messages: [] });
    const responses: ReturnType<typeof createRequestResponse>[] = [];
    const deliverySnapshots: Array<{ modelId?: string; currentModeId?: string; configOptions: unknown }> = [];
    const createRequest = jest.fn((message: string, agentId: string, images?: string[], command?: string) => {
      deliverySnapshots.push({
        modelId: session.modelId,
        currentModeId: session.currentModeId,
        configOptions: session.configOptions.map((option) => ({ ...option })),
      });
      const response = createRequestResponse();
      responses.push(response);
      return {
        message: { agentId, command, images, prompt: message },
        requestId: `request-${responses.length}`,
        response,
      };
    });
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
      await services
        .getLatestChatInputProps()
        .onSend('follow up', undefined, undefined, undefined, { model: 'legacy-stored-model' });
      await flushPromises();
    });

    session.modelId = 'model-2';
    session.currentModeId = 'mode-2';
    session.configOptions = [{ id: 'temperature', value: 'high' }];

    await act(async () => {
      responses[0].finish('completed');
      await flushPromises();
    });

    expect(deliverySnapshots).toEqual([
      {
        modelId: 'model-1',
        currentModeId: 'mode-1',
        configOptions: [{ id: 'temperature', value: 'low' }],
      },
      {
        modelId: 'model-2',
        currentModeId: 'mode-2',
        configOptions: [{ id: 'temperature', value: 'high' }],
      },
    ]);
    expect(createRequest).toHaveBeenNthCalledWith(2, 'follow up', 'default-agent', undefined, undefined);
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
      response: createRequestResponse(),
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
