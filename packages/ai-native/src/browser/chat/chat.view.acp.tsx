import debounce from 'lodash/debounce';
import * as React from 'react';
import { MessageList } from 'react-chat-elements';

import {
  AINativeConfigService,
  AppConfig,
  COMMON_COMMANDS,
  LabelService,
  getIcon,
  localize,
  useInjectable,
  useUpdateOnEvent,
} from '@opensumi/ide-core-browser';
import { Popover, PopoverPosition } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import {
  ACP_THREAD_POOL_SATURATED_ERROR_NAME,
  AIServiceType,
  ActionSourceEnum,
  ActionTypeEnum,
  CancellationToken,
  CancellationTokenSource,
  ChatFeatureRegistryToken,
  ChatInputRegistryToken,
  ChatMessageRole,
  ChatRenderRegistryToken,
  ChatServiceToken,
  CommandService,
  Disposable,
  DisposableCollection,
  IAIReporter,
  IChatComponent,
  IChatContent,
  IHistoryChatMessage,
  URI,
  formatLocalize,
  path,
  uuid,
} from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IMessageService } from '@opensumi/ide-overlay';
import 'react-chat-elements/dist/main.css';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatAgentService, IChatInternalService, IChatMessageStructure } from '../../common';
import {
  LLMContextService,
  LLMContextServiceToken,
  LLM_CONTEXT_KEY,
  LLM_CONTEXT_KEY_REGEX,
} from '../../common/llm-context';
import { CodeBlockData } from '../../common/types';
import { cleanAttachedTextWrapper } from '../../common/utils';
import { createAcpQueuedTurnStartFailureFixture } from '../acp/acp-bdd-runtime-fixtures';
import ChatHistory, { IChatHistoryItem } from '../acp/components/AcpChatHistory';
import { AcpChatViewWrapper } from '../acp/components/AcpChatViewWrapper';
import { AcpPermissionBridgeService } from '../acp/permission-bridge.service';
import { hasAcpChatSendPayload } from '../components/acp/chat-input-validation';
import { FileChange, FileListDisplay } from '../components/ChangeList';
import { CodeBlockWrapperInput } from '../components/ChatEditor';
import { ChatInput } from '../components/ChatInput';
import { ChatMarkdown } from '../components/ChatMarkdown';
import { ChatNotify, ChatReply } from '../components/ChatReply';
import { SlashCustomRender } from '../components/SlashCustomRender';
import { MessageData, createMessageByAI, createMessageByUser } from '../components/utils';
import { WelcomeMessage } from '../components/WelcomeMsg';
import { AIPanelLayoutService } from '../layout/panel-layout.service';
import { BaseApplyService } from '../mcp/base-apply.service';
import { ChatViewHeaderRender, IMCPServerRegistry, TSlashCommandCustomRender, TokenMCPServerRegistry } from '../types';

import { AcpQueuedTurnModule } from './acp-chat-queued-turns';
import { AI_CHAT_NEW_CHAT } from './acp-new-draft.commands';
import { AcpQueuedTurns } from './AcpQueuedTurns';
import {
  AgenticConversationViewModel,
  AgenticConversationViewModelCache,
  isAgenticConversationViewModelCurrent,
  updateAgenticConversationViewModel,
} from './agentic-conversation-view-model';
import { AgenticChatHeaderMaximizeAction } from './AgenticChatHeaderMaximizeAction';
import { AgenticChatPanelHeader } from './AgenticChatPanelHeader';
import { AgenticVirtualMessageList, AgenticVirtualMessageListHandle } from './AgenticVirtualMessageList';
import { ChatModel, ChatRequestModel, ChatSlashCommandItemModel } from './chat-model';
import { ChatProxyService } from './chat-proxy.service';
import { ChatService } from './chat.api.service';
import { ChatFeatureRegistry } from './chat.feature.registry';
import { IChatHistoryRegistry } from './chat.history.registry';
import { ChatInputRegistry } from './chat.input.registry';
import { ChatInternalService } from './chat.internal.service';
import { AcpChatInternalService } from './chat.internal.service.acp';
import styles from './chat.module.less';
import { ChatRenderRegistry } from './chat.render.registry';
import { isAcpResponsePending } from './session-provider';

import type { AcpQueuedTurnPort, AcpTurnDraft, AcpTurnOutcome } from './acp-chat-queued-turns';
import type { ChatInputHandle, ChatInputTurnActions } from './chat.input.registry';
import type { MsgHistoryManager } from '../model/msg-history-manager';

const SCROLL_CLASSNAME = 'chat_scroll';

interface TDispatchAction {
  type: 'add' | 'clear' | 'init';
  payload?: MessageData[];
}

const MAX_TITLE_LENGTH = 100;

interface StartedAcpTurn {
  sessionId: string;
  requestId: string;
  response: ChatRequestModel['response'];
}

interface AcpQueuedTurnPortCallbacks {
  getStatus(sessionId: string | undefined): 'idle' | 'generating';
  start(sessionId: string | undefined, draft: AcpTurnDraft, assertRuntimeActive: () => void): Promise<StartedAcpTurn>;
  requestCancellation(sessionId: string | undefined): Promise<void>;
  cancelPendingStart(sessionId: string | undefined): Promise<void>;
  didFinish(started: StartedAcpTurn): void;
}

type AcpQueuedTurnSessionGuard = (ensuredSessionId?: string) => void;

function observeTurnOutcome(response: ChatRequestModel['response']): {
  outcome: Promise<AcpTurnOutcome>;
  dispose(): void;
} {
  let settle: (outcome: AcpTurnOutcome) => void;
  let settled = false;
  const outcome = new Promise<AcpTurnOutcome>((resolve) => {
    settle = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
  });
  let disposable: { dispose(): void } | undefined;
  const finish = () => {
    if (!response.isComplete) {
      return;
    }
    disposable?.dispose();
    settle(response.isCanceled ? 'manual-stop' : response.errorDetails ? 'agent-error' : 'completed');
  };
  disposable = response.onDidChange(finish);
  finish();
  return {
    outcome,
    dispose: () => {
      disposable?.dispose();
      settle('agent-error');
    },
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function completeResponseWithError(response: ChatRequestModel['response'], error: unknown): void {
  if (response.isComplete) {
    return;
  }
  response.setErrorDetails({ message: getErrorMessage(error) });
  response.complete();
}

function getSessionCreatedAt(session: ChatModel): number {
  const firstMessage = session.history.getMessages()[0];
  return session.createdAt || firstMessage?.timestamp || firstMessage?.replyStartTime || 0;
}

function getVisibleAcpSessions(aiChatService: AcpChatInternalService): ChatModel[] {
  return typeof aiChatService.getVisibleSessions === 'function'
    ? aiChatService.getVisibleSessions()
    : aiChatService.getSessions();
}

const getFileChanges = (codeBlocks: CodeBlockData[]) =>
  codeBlocks
    .map((block) => {
      const rangesFromDiffHunk = block.applyResult?.diff.split('\n').reduce(
        ([del, add], line) => {
          if (line.startsWith('-')) {
            del += 1;
          } else if (line.startsWith('+')) {
            add += 1;
          }
          return [del, add];
        },
        [0, 0],
      ) || [0, 0];
      return {
        path: block.relativePath,
        additions: rangesFromDiffHunk[1],
        deletions: rangesFromDiffHunk[0],
        status: block.status,
      };
    })
    .reduce((acc, curr) => {
      const existingFile = acc.find((file) => file.path === curr.path);
      if (existingFile) {
        existingFile.additions += curr.additions;
        existingFile.deletions += curr.deletions;
        // 使用最新的状态
        existingFile.status = curr.status;
      } else {
        acc.push(curr);
      }
      return acc;
    }, [] as FileChange[]);

export const AIChatViewACP = () => {
  const aiChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  return (
    <AcpChatViewWrapper aiChatService={aiChatService}>
      <AIChatViewACPContent />
    </AcpChatViewWrapper>
  );
};

export const AIChatViewACPContent = () => {
  const aiChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  const chatApiService = useInjectable<ChatService>(ChatServiceToken);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);
  const mcpServerRegistry = useInjectable<IMCPServerRegistry>(TokenMCPServerRegistry);
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const llmContextService = useInjectable<LLMContextService>(LLMContextServiceToken);
  const chatInputRegistry = useInjectable<ChatInputRegistry>(ChatInputRegistryToken);

  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const msgHistoryManager = aiChatService.sessionModel?.history;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const autoScroll = React.useRef<boolean>(true);
  const chatInputRef = React.useRef<(ChatInputHandle & { setInputValue?: (v: string) => void }) | null>(null);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const applyService = useInjectable<BaseApplyService>(BaseApplyService);
  const labelService = useInjectable<LabelService>(LabelService);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const commandService = useInjectable<CommandService>(CommandService);
  const isAgenticLayout = panelLayoutService.getLayoutMode() === 'agentic';
  const [shortcutCommands, setShortcutCommands] = React.useState<ChatSlashCommandItemModel[]>([]);
  const [sessionModelId, setSessionModelId] = React.useState<string | undefined>(aiChatService.sessionModel?.modelId);
  const [hasUserSentMessage, setHasUserSentMessage] = React.useState(false);

  const [changeList, setChangeList] = React.useState<FileChange[]>(
    getFileChanges(applyService.getSessionCodeBlocks() || []),
  );

  const [messageListData, dispatchMessage] = React.useReducer((state: MessageData[], action: TDispatchAction) => {
    switch (action.type) {
      case 'add':
        return [...state, ...(action.payload || [])];
      case 'clear':
        return [];
      case 'init':
        return Array.isArray(action.payload) ? action.payload : [];
      default:
        return state;
    }
  }, []);

  const [loading, setLoading] = React.useState(false);
  const agenticConversationCacheRef = React.useRef(new AgenticConversationViewModelCache());
  const agenticConversationSubscriptionsRef = React.useRef(
    new Map<string, { history: MsgHistoryManager; disposable: { dispose(): void } }>(),
  );
  const [agenticConversation, setAgenticConversation] = React.useState<AgenticConversationViewModel>();
  const agenticMessageListRef = React.useRef<AgenticVirtualMessageListHandle>(null);
  const [queuedTurnsExpanded, setQueuedTurnsExpanded] = React.useState(true);
  const mainInputHandleRef = React.useRef<ChatInputHandle | null>(null);
  const queuedEditorHandleRef = React.useRef<ChatInputHandle | null>(null);
  const queuedEditorHandleOwnerRef = React.useRef<object | null>(null);
  const manuallyCollapsedQueueRef = React.useRef(false);
  const previousQueuedTurnCountRef = React.useRef(0);
  const queuedTurnSessionRef = React.useRef<string | undefined>(undefined);
  const liveSessionIdRef = React.useRef(aiChatService.sessionModel?.sessionId);
  const viewLifecycleRef = React.useRef({ generation: 0, mounted: false });
  const shouldFailQueuedTurnStart = React.useMemo(() => createAcpQueuedTurnStartFailureFixture(), []);
  liveSessionIdRef.current = aiChatService.sessionModel?.sessionId;
  const queuedTurnPortCallbacksRef = React.useRef<AcpQueuedTurnPortCallbacks>({
    getStatus: () => 'idle',
    start: async () => {
      throw new Error('ACP queued turn port is not ready.');
    },
    requestCancellation: async () => undefined,
    cancelPendingStart: async () => undefined,
    didFinish: () => undefined,
  });
  const queuedTurnRuntime = React.useMemo(() => {
    const activeTurns = new Map<
      string,
      {
        started: StartedAcpTurn;
        observer: ReturnType<typeof observeTurnOutcome>;
        sessionModel: ChatModel | undefined;
      }
    >();
    let active = false;
    let generation = 0;
    let queuedTurns: AcpQueuedTurnModule;
    const assertRuntimeActive = (token: number) => {
      if (!active || token !== generation) {
        throw new Error('ACP queued turn runtime is inactive.');
      }
    };
    const port: AcpQueuedTurnPort = {
      getStatus: (sessionId) => {
        if (!active) {
          return 'idle';
        }
        return queuedTurnPortCallbacksRef.current.getStatus(sessionId);
      },
      start: async (sessionId, draft) => {
        const token = generation;
        const assertStartActive = () => assertRuntimeActive(token);
        assertStartActive();
        const started = await queuedTurnPortCallbacksRef.current.start(sessionId, draft, assertStartActive);
        assertStartActive();
        const observer = observeTurnOutcome(started.response);
        activeTurns.set(started.sessionId, { started, observer, sessionModel: aiChatService.sessionModel });
        void observer.outcome.then(() => {
          const isCurrentRequest = activeTurns.get(started.sessionId)?.started.requestId === started.requestId;
          if (isCurrentRequest) {
            activeTurns.delete(started.sessionId);
          }
          if (isCurrentRequest && active && token === generation) {
            queuedTurnPortCallbacksRef.current.didFinish(started);
          }
        });
        return {
          id: started.requestId,
          sessionId: started.sessionId,
          outcome: observer.outcome,
        };
      },
      ensureCurrentCancelled: async (sessionId) => {
        if (!active) {
          throw new Error('ACP queued turn runtime is inactive.');
        }
        const activeTurn = sessionId ? activeTurns.get(sessionId) : undefined;
        const activeTurnBelongsToCurrentSession = activeTurn?.sessionModel === aiChatService.sessionModel;
        if (queuedTurnPortCallbacksRef.current.getStatus(sessionId) === 'idle' && !activeTurnBelongsToCurrentSession) {
          return;
        }
        try {
          await queuedTurnPortCallbacksRef.current.requestCancellation(sessionId);
        } catch (error) {
          if (!active) {
            throw new Error('ACP queued turn runtime is inactive.');
          }
          // A tracked response may outlive the session's active status briefly.
          // Once the session is idle, a cancellation rejection means the response
          // was already retired and should not block the retained queue.
          if (queuedTurnPortCallbacksRef.current.getStatus(sessionId) === 'idle') {
            return;
          }
          throw error;
        }
        if (!active) {
          throw new Error('ACP queued turn runtime is inactive.');
        }
        if (activeTurnBelongsToCurrentSession && activeTurn) {
          await activeTurn.observer.outcome;
        }
      },
      cancelPendingStart: async (sessionId) => {
        if (!active || sessionId !== undefined) {
          throw new Error('ACP first-launch cancellation is no longer available.');
        }
        await queuedTurnPortCallbacksRef.current.cancelPendingStart(sessionId);
      },
    };
    queuedTurns = new AcpQueuedTurnModule(port);
    return {
      queuedTurns,
      setup: () => {
        generation += 1;
        active = true;
      },
      teardown: () => {
        if (queuedTurns.snapshot.initialStartPending) {
          void queuedTurns.cancelInitialStart();
        }
        active = false;
        generation += 1;
        queuedTurns.deactivate();
        activeTurns.forEach(({ observer }) => observer.dispose());
        activeTurns.clear();
      },
    };
  }, []);
  const queuedTurns = queuedTurnRuntime.queuedTurns;
  const [queuedTurnSnapshot, setQueuedTurnSnapshot] = React.useState(() => queuedTurns.snapshot);
  const [sessionLoading, setSessionLoading] = React.useState(() => aiChatService.isSessionLoading);
  const [agentId, setAgentId] = React.useState('');
  const [defaultAgentId, setDefaultAgentId] = React.useState<string>('');
  const [command, setCommand] = React.useState('');
  const [theme, setTheme] = React.useState<string | null>(null);

  const setChatLoading = React.useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  React.useEffect(() => {
    setQueuedTurnSnapshot(queuedTurns.snapshot);
    const disposable = queuedTurns.onDidChange(setQueuedTurnSnapshot);
    return () => disposable.dispose();
  }, [queuedTurns]);

  React.useEffect(() => {
    queuedTurnRuntime.setup();
    return () => queuedTurnRuntime.teardown();
  }, [queuedTurnRuntime]);

  React.useLayoutEffect(() => {
    const generation = viewLifecycleRef.current.generation + 1;
    viewLifecycleRef.current = { generation, mounted: true };
    return () => {
      if (viewLifecycleRef.current.generation === generation) {
        viewLifecycleRef.current = { generation: generation + 1, mounted: false };
      }
      mainInputHandleRef.current = null;
      queuedEditorHandleRef.current = null;
      queuedEditorHandleOwnerRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const sessionChanged = queuedTurnSessionRef.current !== queuedTurnSnapshot.activeSessionId;
    if (sessionChanged) {
      queuedTurnSessionRef.current = queuedTurnSnapshot.activeSessionId;
      manuallyCollapsedQueueRef.current = false;
      previousQueuedTurnCountRef.current = 0;
    }

    if (
      previousQueuedTurnCountRef.current === 0 &&
      queuedTurnSnapshot.entries.length > 0 &&
      !manuallyCollapsedQueueRef.current
    ) {
      setQueuedTurnsExpanded(true);
    }
    previousQueuedTurnCountRef.current = queuedTurnSnapshot.entries.length;
  }, [queuedTurnSnapshot.activeSessionId, queuedTurnSnapshot.entries.length]);
  // 切换session或Agent输出状态变化时
  React.useEffect(() => {
    setSessionModelId(aiChatService.sessionModel?.modelId);
  }, [loading, aiChatService.sessionModel]);

  React.useEffect(() => {
    const dispose = aiChatService.onSessionLoadingChange((isLoading) => {
      setSessionLoading(isLoading);
    });
    setSessionLoading(aiChatService.isSessionLoading);
    return () => dispose.dispose();
  }, [aiChatService]);

  React.useEffect(() => {
    const disposer = new Disposable();
    const doUpdate = () => {
      const fileChanges = getFileChanges(applyService.getSessionCodeBlocks() || []);
      setChangeList(fileChanges);
    };
    disposer.addDispose(aiChatService.onChangeSession(doUpdate));
    // TODO: 全量获取性能不好
    disposer.addDispose(applyService.onCodeBlockUpdate(doUpdate));
    return () => disposer.dispose();
  }, []);

  React.useEffect(() => {
    const featureSlashCommands = chatFeatureRegistry.getAllShortcutSlashCommand();

    const dispose = chatAgentService.onDidChangeAgents(() => {
      const agentSlashCommands = chatAgentService
        .getCommands()
        .filter((c) => c.isShortcut)
        .map(
          (c) =>
            new ChatSlashCommandItemModel(
              {
                icon: '',
                name: `${c.name} `,
                description: c.description,
                isShortcut: c.isShortcut,
              },
              c.name,
              c.agentId,
            ),
        );

      setShortcutCommands(featureSlashCommands.concat(agentSlashCommands));
    });

    setShortcutCommands(featureSlashCommands);

    return () => dispose.dispose();
  }, [chatFeatureRegistry, chatAgentService]);

  useUpdateOnEvent(aiChatService.onChangeSession);
  useUpdateOnEvent(aiChatService.onSessionModelChange);

  const draftSessionState = aiChatService.getDraftSessionState();
  const footerAgentModes = aiChatService.sessionModel?.agentModes || draftSessionState.agentModes;
  const footerCurrentModeId = aiChatService.sessionModel?.currentModeId || draftSessionState.currentModeId;
  const footerAgentModels = aiChatService.sessionModel?.agentModels || draftSessionState.agentModels;
  const footerCurrentModelId = aiChatService.sessionModel?.modelId || draftSessionState.modelId;
  const footerConfigOptions = aiChatService.sessionModel?.configOptions || draftSessionState.configOptions;

  // 1. 优先使用 ChatInputRegistry 注册的输入组件（按优先级 + when 条件匹配）
  const activeChatInput = chatInputRegistry.getActiveChatInput();
  const activeChatInputId = activeChatInput?.id;
  const ActiveChatInputComponent = activeChatInput?.component;

  const ChatInputWrapperRender = React.useMemo(() => {
    if (ActiveChatInputComponent) {
      return ActiveChatInputComponent;
    }
    // 2. 向后兼容：使用 registerInputRender 注册的
    if (chatRenderRegistry.chatInputRender) {
      return chatRenderRegistry.chatInputRender;
    }
    // 3. 最降级
    return ChatInput;
  }, [ActiveChatInputComponent, chatRenderRegistry.chatInputRender]);

  const handleActiveInputReady = React.useMemo(() => {
    let ownedHandle: ChatInputHandle | null = null;
    return (handle: Parameters<ChatInputRegistry['setActiveInputHandle']>[0]) => {
      if (handle) {
        ownedHandle = handle;
        chatInputRegistry.setActiveInputHandle(handle, activeChatInputId);
      } else if (ownedHandle && chatInputRegistry.getActiveInputHandle() === ownedHandle) {
        chatInputRegistry.setActiveInputHandle(null, activeChatInputId);
      }
      mainInputHandleRef.current = chatInputRegistry.getActiveInputHandle();
    };
  }, [activeChatInputId, chatInputRegistry]);

  const handleChatInputRef = React.useCallback(
    (handle: (ChatInputHandle & { setInputValue?: (v: string) => void }) | null) => {
      chatInputRef.current = handle;
      handleActiveInputReady(handle);
    },
    [handleActiveInputReady],
  );

  const handleQueuedEditorReady = React.useMemo(() => {
    const owner = {};
    const lifecycleGeneration = viewLifecycleRef.current.generation;
    const sessionId = queuedTurns.snapshot.activeSessionId;
    const editingTurnId = queuedTurnSnapshot.editingTurnId;
    let didFocus = false;
    return (handle: ChatInputHandle | null) => {
      if (handle) {
        queuedEditorHandleOwnerRef.current = owner;
        queuedEditorHandleRef.current = handle;
        const lifecycle = viewLifecycleRef.current;
        if (
          !didFocus &&
          editingTurnId &&
          lifecycle.mounted &&
          lifecycle.generation === lifecycleGeneration &&
          queuedEditorHandleOwnerRef.current === owner &&
          queuedTurns.snapshot.activeSessionId === sessionId &&
          queuedTurns.snapshot.editingTurnId === editingTurnId &&
          liveSessionIdRef.current === sessionId &&
          aiChatService.sessionModel?.sessionId === sessionId
        ) {
          didFocus = true;
          handle.focus?.();
        }
      } else if (queuedEditorHandleOwnerRef.current === owner) {
        queuedEditorHandleOwnerRef.current = null;
        queuedEditorHandleRef.current = null;
      }
    };
  }, [
    activeChatInputId,
    activeChatInput?.queuedTurnEditor,
    aiChatService,
    queuedTurnSnapshot.editingTurnId,
    queuedTurns,
  ]);

  const captureMainInputFocus = React.useCallback(
    () => ({
      generation: viewLifecycleRef.current.generation,
      sessionId: queuedTurns.snapshot.activeSessionId,
    }),
    [queuedTurns],
  );

  const focusMainInputAfterAction = React.useCallback(
    (captured: { generation: number; sessionId: string | undefined }) => {
      const lifecycle = viewLifecycleRef.current;
      if (
        !lifecycle.mounted ||
        lifecycle.generation !== captured.generation ||
        queuedTurns.snapshot.activeSessionId !== captured.sessionId ||
        liveSessionIdRef.current !== captured.sessionId ||
        aiChatService.sessionModel?.sessionId !== captured.sessionId
      ) {
        return;
      }
      mainInputHandleRef.current?.focus?.();
    },
    [aiChatService, queuedTurns],
  );

  const firstMsg = React.useMemo(
    () =>
      createMessageByAI({
        id: uuid(6),
        relationId: '',
        text: <WelcomeMessage />,
      }),
    [],
  );

  const onDidWheel = React.useCallback(
    (e: WheelEvent) => {
      // 向上滚动
      if (e.deltaY < 0) {
        autoScroll.current = false;
      } else {
        autoScroll.current = true;
      }
    },
    [autoScroll],
  );

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.addEventListener('wheel', onDidWheel);
      return () => {
        containerRef.current?.removeEventListener('wheel', onDidWheel);
      };
    }
  }, [autoScroll]);

  const scrollToBottom = React.useCallback(() => {
    if (containerRef && containerRef.current && autoScroll.current) {
      const lastElement = containerRef.current.lastElementChild;
      if (lastElement) {
        lastElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
      // 出现滚动条时出现分割线
      if (containerRef.current.scrollHeight > containerRef.current.clientHeight) {
        containerRef.current.classList.add(SCROLL_CLASSNAME);
      }
    }
  }, [containerRef, autoScroll]);

  const handleDispatchMessage = React.useCallback(
    (dispatch: TDispatchAction) => {
      dispatchMessage(dispatch);
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    },
    [dispatchMessage, scrollToBottom],
  );

  React.useEffect(() => {
    handleDispatchMessage({ type: 'init', payload: [firstMsg] });
  }, []);

  React.useEffect(() => {
    const disposer = new Disposable();

    disposer.addDispose(
      chatApiService.onScrollToBottom(() => {
        requestAnimationFrame(() => {
          // scrollToBottom();
        });
      }),
    );

    disposer.addDispose(
      chatApiService.onChatMessageLaunch(async (message) => {
        if (message.immediate !== false) {
          if (loading || sessionLoading) {
            return;
          }
          await handleSend(message.message, message.images, message.agentId, message.command);
        } else {
          if (message.agentId) {
            setAgentId(message.agentId);
          }
          if (message.command) {
            setCommand(message.command);
          }
          chatInputRef.current?.setInputValue?.(message.message);
        }
      }),
    );

    disposer.addDispose(
      chatApiService.onChatReplyMessageLaunch((data) => {
        if (!msgHistoryManager) {
          return;
        }

        if (data.kind === 'content') {
          const relationId = aiReporter.start(AIServiceType.CustomReply, {
            message: data.content,
            sessionId: aiChatService.sessionModel?.sessionId,
          });
          msgHistoryManager.addAssistantMessage({
            content: data.content,
            relationId,
          });
          renderSimpleMarkdownReply({ chunk: data.content, relationId });
        } else {
          const relationId = aiReporter.start(AIServiceType.CustomReply, {
            message: 'component#' + data.component,
            sessionId: aiChatService.sessionModel?.sessionId,
          });
          msgHistoryManager.addAssistantMessage({
            componentId: data.component,
            componentValue: data.value,
            content: '',
            relationId,
          });
          renderCustomComponent({ chunk: data, relationId });
        }
      }),
    );

    disposer.addDispose(
      chatApiService.onChatMessageListLaunch((list) => {
        const messageList: MessageData[] = [];

        list.forEach((item) => {
          const { role } = item;

          const relationId = aiReporter.start(AIServiceType.Chat, {
            message: '',
            sessionId: aiChatService.sessionModel?.sessionId,
          });

          if (role === 'assistant') {
            const newChunk = item as IChatComponent | IChatContent;

            messageList.push(
              createMessageByAI(
                {
                  id: uuid(6),
                  relationId,
                  text: <ChatNotify requestId={relationId} chunk={newChunk} />,
                },
                styles.chat_notify,
              ),
            );
          }

          if (role === 'user') {
            const { message } = item;
            const agentId = ChatProxyService.AGENT_ID;
            const ChatUserRoleRender = chatRenderRegistry.chatUserRoleRender;
            const visibleAgentId = agentId === ChatProxyService.AGENT_ID ? '' : agentId;

            messageList.push(
              createMessageByUser(
                {
                  id: uuid(6),
                  relationId,
                  text: ChatUserRoleRender ? (
                    <ChatUserRoleRender content={message} agentId={visibleAgentId} />
                  ) : (
                    <CodeBlockWrapperInput
                      relationId={relationId}
                      text={message}
                      agentId={visibleAgentId}
                      command={command}
                      labelService={labelService}
                      workspaceService={workspaceService}
                      commandService={commandService}
                    />
                  ),
                },
                styles.chat_message_code,
              ),
            );
          }
        });

        handleDispatchMessage({ type: 'add', payload: messageList });

        setTimeout(scrollToBottom, 0);
      }),
    );

    return () => disposer.dispose();
  }, [chatApiService, chatRenderRegistry.chatAIRoleRender, msgHistoryManager, sessionLoading]);

  React.useEffect(() => {
    const disposer = new Disposable();

    disposer.addDispose(
      chatAgentService.onDidSendMessage((chunk) => {
        const newChunk = chunk as IChatComponent | IChatContent;
        const relationId = aiReporter.start(AIServiceType.Agent, {
          message: '',
        });

        const notifyMessage = createMessageByAI(
          {
            id: uuid(6),
            relationId,
            text: <ChatNotify requestId={aiChatService.latestRequestId} chunk={newChunk} />,
          },
          styles.chat_notify,
        );

        handleDispatchMessage({ type: 'add', payload: [notifyMessage] });
      }),
    );

    disposer.addDispose(
      chatAgentService.onDidChangeAgents(async () => {
        const newDefaultAgentId = chatAgentService.getDefaultAgentId();
        setDefaultAgentId(newDefaultAgentId ?? '');
      }),
    );

    return () => disposer.dispose();
  }, [chatAgentService, msgHistoryManager, aiChatService]);

  const handleSlashCustomRender = React.useCallback(
    async (value: {
      userMessage: string;
      render: TSlashCommandCustomRender;
      relationId: string;
      requestId: string;
      startTime: number;
      history: MsgHistoryManager;
      command?: string;
      agentId?: string;
    }) => {
      const { userMessage, relationId, requestId, render, startTime, history, command, agentId } = value;

      history.addAssistantMessage({
        type: 'component',
        content: '',
      });

      const aiMessage = createMessageByAI({
        id: uuid(6),
        relationId,
        className: styles.chat_with_more_actions,
        text: (
          <SlashCustomRender
            userMessage={userMessage}
            startTime={startTime}
            relationId={relationId}
            requestId={requestId}
            renderContent={render}
            command={command}
            agentId={agentId}
          />
        ),
      });

      handleDispatchMessage({ type: 'add', payload: [aiMessage] });
    },
    [containerRef],
  );

  const renderUserMessage = React.useCallback(
    async (renderModel: {
      message: string;
      images?: string[];
      agentId?: string;
      relationId: string;
      command?: string;
    }) => {
      const ChatUserRoleRender = chatRenderRegistry.chatUserRoleRender;

      const { message, images, agentId, relationId, command } = renderModel;

      const visibleAgentId = agentId === ChatProxyService.AGENT_ID ? '' : agentId;

      const userMessage = createMessageByUser(
        {
          id: uuid(6),
          relationId,
          text: ChatUserRoleRender ? (
            <ChatUserRoleRender content={message} images={images} agentId={visibleAgentId} command={command} />
          ) : (
            <CodeBlockWrapperInput
              labelService={labelService}
              relationId={relationId}
              text={message}
              images={images}
              agentId={visibleAgentId}
              command={command}
              workspaceService={workspaceService}
              commandService={commandService}
            />
          ),
        },
        styles.chat_message_code,
      );

      handleDispatchMessage({ type: 'add', payload: [userMessage] });
    },
    [chatRenderRegistry, chatRenderRegistry.chatUserRoleRender, msgHistoryManager, scrollToBottom],
  );

  const renderReply = React.useCallback(
    async (renderModel: {
      message: string;
      agentId?: string;
      request: ChatRequestModel;
      relationId: string;
      command?: string;
      startTime: number;
      msgId: string;
      history: MsgHistoryManager;
    }) => {
      const { message, agentId, request, relationId, command, startTime, msgId, history } = renderModel;

      const visibleAgentId = agentId === ChatProxyService.AGENT_ID ? '' : agentId;

      if (agentId === ChatProxyService.AGENT_ID && command) {
        const commandHandler = chatFeatureRegistry.getSlashCommandHandler(command);
        if (commandHandler && commandHandler.providerRender) {
          return handleSlashCustomRender({
            userMessage: message,
            render: commandHandler.providerRender,
            relationId,
            requestId: request.requestId,
            startTime,
            history,
            agentId,
            command,
          });
        }
      }

      const aiMessage = createMessageByAI({
        id: uuid(6),
        relationId,
        className: styles.chat_with_more_actions,
        text: (
          <ChatReply
            relationId={relationId}
            request={request}
            startTime={startTime}
            agentId={visibleAgentId}
            command={command}
            onDidChange={() => {
              scrollToBottom();
            }}
            history={history}
            onRegenerate={() => {
              if (request) {
                void aiChatService.sendRequest(request, true);
              }
            }}
            msgId={msgId}
            collapseReasoningByDefault
          />
        ),
      });
      handleDispatchMessage({ type: 'add', payload: [aiMessage] });
    },
    [chatRenderRegistry, scrollToBottom],
  );

  const renderSimpleMarkdownReply = React.useCallback(
    (renderModel: { chunk: string; relationId: string }) => {
      const { chunk, relationId } = renderModel;
      let renderContent = <ChatMarkdown markdown={chunk} fillInIncompleteTokens agentId={agentId} command={command} />;

      if (chatRenderRegistry.chatAIRoleRender) {
        const ChatAIRoleRender = chatRenderRegistry.chatAIRoleRender;
        renderContent = <ChatAIRoleRender content={chunk} />;
      }

      const aiMessage = createMessageByAI({
        id: uuid(6),
        relationId,
        text: renderContent,
        className: styles.chat_with_more_actions,
      });

      handleDispatchMessage({ type: 'add', payload: [aiMessage] });
    },
    [chatRenderRegistry, msgHistoryManager, scrollToBottom],
  );

  const renderCustomComponent = React.useCallback(
    (renderModel: { chunk: IChatComponent; relationId: string }) => {
      const { chunk, relationId } = renderModel;

      const aiMessage = createMessageByAI(
        {
          id: uuid(6),
          relationId,
          text: <ChatNotify requestId={relationId} chunk={chunk} />,
        },
        styles.chat_notify,
      );
      handleDispatchMessage({ type: 'add', payload: [aiMessage] });
    },
    [chatRenderRegistry, msgHistoryManager, scrollToBottom],
  );

  const handleAgentReply = React.useCallback(
    async (value: IChatMessageStructure, sessionGuard?: AcpQueuedTurnSessionGuard) => {
      const { message, images, agentId, command, reportExtra } = value;
      const { actionType, actionSource } = reportExtra || {};

      if (!hasAcpChatSendPayload({ message, images, command })) {
        return undefined;
      }

      sessionGuard?.();
      let sessionModel: ChatModel;
      try {
        sessionModel = await aiChatService.ensureSessionModel();
      } catch (error) {
        const errorName = error instanceof Error ? error.name : undefined;
        if (errorName !== ACP_THREAD_POOL_SATURATED_ERROR_NAME && errorName !== 'ACP_SESSION_CREATION_CANCELLED') {
          messageService.error(`Failed to create session. (${getErrorMessage(error)})`);
        }
        throw error;
      }
      sessionGuard?.(sessionModel.sessionId);

      const activeHistory = sessionModel.history;
      sessionGuard?.();
      const request = aiChatService.createRequest(
        message.replaceAll(LLM_CONTEXT_KEY_REGEX, ''),
        agentId!,
        images,
        command,
      );
      if (!request) {
        return undefined;
      }

      sessionGuard?.();
      setChatLoading(true);
      aiChatService.setLatestRequestId(request.requestId);

      const startTime = Date.now();
      const reportType = ChatProxyService.AGENT_ID === agentId ? AIServiceType.Chat : AIServiceType.Agent;

      const relationId = aiReporter.start(
        command || reportType,
        {
          agentId,
          userMessage: message,
          actionType,
          actionSource,
          sessionId: sessionModel.sessionId,
        },
        // 由于涉及 tool 调用，超时时间设置长一点
        600 * 1000,
      );
      sessionGuard?.();
      activeHistory.addUserMessage({
        content: message,
        images: images || [],
        agentId: agentId!,
        agentCommand: command!,
        relationId,
      });

      await renderUserMessage({
        relationId,
        message,
        images,
        command,
        agentId,
      });

      sessionGuard?.();
      let requestAccepted = false;
      let resolveRequestAccepted!: () => void;
      const requestAcceptance = new Promise<void>((resolve) => {
        resolveRequestAccepted = resolve;
      });
      let sendResult: Promise<void>;
      try {
        sendResult = Promise.resolve(
          aiChatService.sendRequest(request, false, () => {
            requestAccepted = true;
            resolveRequestAccepted();
          }),
        );
        void sendResult.catch((error) => {
          completeResponseWithError(request.response, error);
        });
      } catch (error) {
        sendResult = Promise.reject(error);
        void sendResult.catch(() => undefined);
        completeResponseWithError(request.response, error);
      }

      await Promise.race([
        requestAcceptance,
        sendResult.then(() => {
          if (!requestAccepted) {
            throw new Error(request.response.errorDetails?.message || 'ACP request ended before it was accepted.');
          }
        }),
      ]);

      sessionGuard?.();
      const msgId = activeHistory.addAssistantMessage({
        content: '',
        relationId,
        requestId: request.requestId,
        replyStartTime: startTime,
      });

      // 创建消息时，设置当前活跃的消息信息，便于toolCall打点
      mcpServerRegistry.activeMessageInfo = {
        messageId: msgId,
        sessionId: sessionModel.sessionId,
      };

      await renderReply({
        startTime,
        relationId,
        message,
        agentId,
        command,
        request,
        msgId,
        history: activeHistory,
      });
      sessionGuard?.();
      return {
        sessionId: sessionModel.sessionId,
        requestId: request.requestId,
        response: request.response,
      } satisfies StartedAcpTurn;
    },
    [
      aiChatService,
      aiReporter,
      chatRenderRegistry,
      chatRenderRegistry.chatUserRoleRender,
      mcpServerRegistry,
      messageService,
      renderReply,
      renderUserMessage,
      scrollToBottom,
    ],
  );

  const sendMessageNow = React.useCallback(
    async (
      message: string,
      images?: string[],
      agentId?: string,
      command?: string,
      sessionGuard?: AcpQueuedTurnSessionGuard,
    ) => {
      if (!hasAcpChatSendPayload({ message, images, command })) {
        return undefined;
      }

      sessionGuard?.();
      const reportExtra = {
        actionSource: ActionSourceEnum.Chat,
        actionType: ActionTypeEnum.Send,
      };
      const resolvedAgentId = agentId || ChatProxyService.AGENT_ID;
      // 提取并替换 {{@file:xxx}} 中的文件内容
      let processedContent = message;
      const filePattern = /\{\{@file:(.*?)\}\}/g;
      const fileMatches = message.match(filePattern);
      if (fileMatches) {
        for (const match of fileMatches) {
          const filePath = match.replace(/\{\{@file:(.*?)\}\}/, '$1');
          const fileUri = new URI(filePath);
          const relativePath = (await workspaceService.asRelativePath(fileUri))?.path || fileUri.displayName;
          sessionGuard?.();
          processedContent = processedContent.replace(match, `\`${LLM_CONTEXT_KEY.AttachedFile}${relativePath}\``);
        }
      }

      const folderPattern = /\{\{@folder:(.*?)\}\}/g;
      const folderMatches = processedContent.match(folderPattern);
      if (folderMatches) {
        for (const match of folderMatches) {
          const folderPath = match.replace(/\{\{@folder:(.*?)\}\}/, '$1');
          const folderUri = new URI(folderPath);
          const relativePath = (await workspaceService.asRelativePath(folderUri))?.path || folderUri.displayName;
          sessionGuard?.();
          processedContent = processedContent.replace(match, `\`${LLM_CONTEXT_KEY.AttachedFolder}${relativePath}\``);
        }
      }
      const codePattern = /\{\{@code:(.*?)\}\}/g;
      const codeMatches = processedContent.match(codePattern);
      if (codeMatches) {
        for (const match of codeMatches) {
          const filePathWithLineRange = match.replace(/\{\{@code:(.*?)\}\}/, '$1');
          const [filePath, lineRange] = filePathWithLineRange.split(':');
          let range: [number, number] = [0, 0];
          if (lineRange) {
            const [startLine, endLine] = lineRange.slice(1).split('-');
            range = [parseInt(startLine, 10), parseInt(endLine, 10)];
          }
          const fileUri = new URI(filePath);
          const relativePath = (await workspaceService.asRelativePath(fileUri))?.path || fileUri.displayName;
          sessionGuard?.();
          processedContent = processedContent.replace(
            match,
            `\`${LLM_CONTEXT_KEY.AttachedFile}${relativePath}:L${range[0]}-${range[1]}\``,
          );
        }
      }
      const rulePattern = /\{\{@rule:(.*?)\}\}/g;
      const ruleMatches = processedContent.match(rulePattern);
      if (ruleMatches) {
        for (const match of ruleMatches) {
          const ruleName = match.replace(/\{\{@rule:(.*?)\}\}/, '$1');
          const ruleUri = new URI(ruleName);
          processedContent = processedContent.replace(
            match,
            `\`${LLM_CONTEXT_KEY.AttachedFile}${ruleUri.displayName}\``,
          );
        }
      }
      const started = await handleAgentReply(
        {
          message: processedContent,
          images,
          agentId: resolvedAgentId,
          command,
          reportExtra,
        },
        sessionGuard,
      );
      sessionGuard?.();
      if (started) {
        setHasUserSentMessage(true);
      }
      return started;
    },
    [handleAgentReply, setHasUserSentMessage, workspaceService],
  );

  queuedTurnPortCallbacksRef.current = {
    getStatus: (sessionId) => {
      const sessionModel = aiChatService.sessionModel;
      if (!sessionModel || (sessionId !== undefined && sessionModel.sessionId !== sessionId)) {
        return 'idle';
      }
      return isAcpResponsePending(sessionModel.threadStatus) ? 'generating' : 'idle';
    },
    start: async (sessionId, draft, assertRuntimeActive) => {
      let activeSessionId = sessionId;
      let canPromoteInitialSession = sessionId === undefined;
      const sessionGuard: AcpQueuedTurnSessionGuard = (ensuredSessionId) => {
        assertRuntimeActive();
        const currentSessionId = aiChatService.sessionModel?.sessionId;
        if (ensuredSessionId !== undefined && canPromoteInitialSession && activeSessionId === undefined) {
          if (currentSessionId !== ensuredSessionId) {
            throw new Error('ACP queued turn session is no longer active.');
          }
          activeSessionId = ensuredSessionId;
          canPromoteInitialSession = false;
        } else if (ensuredSessionId !== undefined && ensuredSessionId !== activeSessionId) {
          throw new Error('ACP queued turn session is no longer active.');
        }
        if (currentSessionId !== activeSessionId) {
          throw new Error('ACP queued turn session is no longer active.');
        }
      };
      sessionGuard();
      if (shouldFailQueuedTurnStart()) {
        throw new Error('ACP BDD queued-turn start failure fixture rejected the turn.');
      }
      const started = await sendMessageNow(
        draft.message,
        draft.images ? [...draft.images] : undefined,
        draft.agentId,
        draft.command,
        sessionGuard,
      );
      if (!started) {
        throw new Error('Failed to start ACP queued turn.');
      }
      return started;
    },
    requestCancellation: async (sessionId) => {
      if (aiChatService.sessionModel?.sessionId !== sessionId) {
        throw new Error('ACP queued turn session is no longer active.');
      }
      await aiChatService.cancelRequest();
    },
    cancelPendingStart: async () => {
      await aiChatService.cancelPendingSessionCreation();
    },
    didFinish: (started) => {
      const activeSessionId = aiChatService.sessionModel?.sessionId;
      if (activeSessionId === undefined || activeSessionId === started.sessionId) {
        setChatLoading(false);
      }
    },
  };

  const turnActions = React.useMemo<ChatInputTurnActions>(
    () => ({
      submit: (draft, intent) => queuedTurns.submit(draft, intent),
      stop: () => queuedTurns.stop(),
      fastTrack: () => queuedTurns.fastTrack(),
      invalidateFastTrack: () => queuedTurns.invalidateFastTrack(),
      takeBackLastQueuedTurn: () => queuedTurns.takeBackLast(),
    }),
    [queuedTurns],
  );

  const handleSend = React.useCallback(
    async (
      message: string,
      images?: string[],
      agentId?: string,
      command?: string,
      _option?: { model: string; [key: string]: unknown },
    ) => {
      if (sessionLoading) {
        return false;
      }
      const resolvedAgentId = agentId || ChatProxyService.AGENT_ID;
      const result = await queuedTurns.submit(
        {
          message,
          images,
          agentId: resolvedAgentId,
          command,
        },
        'normal',
      );
      if (result.accepted) {
        setHasUserSentMessage(true);
      }
      return result.accepted;
    },
    [queuedTurns, sessionLoading],
  );

  const handleClear = React.useCallback(() => {
    aiChatService.clearSessionModel();
    chatApiService.clearHistoryMessages();
    clearChatContent();
    queuedTurns.clear();
    setQueuedTurnsExpanded(true);
    manuallyCollapsedQueueRef.current = false;
    setHasUserSentMessage(false);
  }, [messageListData, queuedTurns]);

  const clearChatContent = React.useCallback(() => {
    containerRef?.current?.classList.remove(SCROLL_CLASSNAME);
    handleDispatchMessage({ type: 'init', payload: [firstMsg] });
  }, [messageListData]);

  const handleShortcutCommandClick = (commandModel: ChatSlashCommandItemModel) => {
    if (loading) {
      return;
    }
    setTheme(commandModel.nameWithSlash);
    setAgentId(commandModel.agentId!);
    setCommand(commandModel.command!);
  };

  const handleQueuedTurnDelete = React.useCallback(
    async (id: string) => {
      const focus = captureMainInputFocus();
      const result = await queuedTurns.remove(id);
      if (result.accepted) {
        focusMainInputAfterAction(focus);
      }
    },
    [captureMainInputFocus, focusMainInputAfterAction, queuedTurns],
  );

  const handleQueuedTurnClear = React.useCallback(() => {
    const focus = captureMainInputFocus();
    queuedTurns.clear();
    focusMainInputAfterAction(focus);
  }, [captureMainInputFocus, focusMainInputAfterAction, queuedTurns]);

  const handleQueuedTurnEdit = React.useCallback(
    (id: string) => {
      const result = queuedTurns.beginEdit(id);
      if (!result.accepted && result.reason === 'another-turn-is-editing') {
        queuedEditorHandleRef.current?.focus?.();
      }
    },
    [queuedTurns],
  );

  const handleQueuedTurnCommit = React.useCallback(
    async (id: string, draft: AcpTurnDraft, immediate: boolean) => {
      const focus = captureMainInputFocus();
      const result = await queuedTurns.commitEdit(id, draft, immediate);
      if (result.accepted) {
        focusMainInputAfterAction(focus);
      }
      return result;
    },
    [captureMainInputFocus, focusMainInputAfterAction, queuedTurns],
  );

  const handleQueuedTurnCancel = React.useCallback(
    async (id: string) => {
      const focus = captureMainInputFocus();
      const result = await queuedTurns.cancelEdit(id);
      if (result.accepted) {
        focusMainInputAfterAction(focus);
      }
    },
    [captureMainInputFocus, focusMainInputAfterAction, queuedTurns],
  );

  const handleQueuedTurnImmediate = React.useCallback(
    async (id: string) => {
      const focus = captureMainInputFocus();
      const result = await queuedTurns.sendImmediately(id);
      if (result.accepted) {
        focusMainInputAfterAction(focus);
      }
    },
    [captureMainInputFocus, focusMainInputAfterAction, queuedTurns],
  );

  const handleQueuedTurnsToggle = React.useCallback(() => {
    setQueuedTurnsExpanded((expanded) => {
      const nextExpanded = !expanded;
      if (!nextExpanded) {
        manuallyCollapsedQueueRef.current = true;
      }
      return nextExpanded;
    });
  }, []);

  const handleQueuedTurnsResume = React.useCallback(() => {
    if (queuedTurns.snapshot.pauseError?.name === 'ACP_THREAD_POOL_SATURATED') {
      const latestDraft = mainInputHandleRef.current?.getDraft?.() || aiChatService.getInputDraft();
      if (latestDraft) {
        queuedTurns.replaceFailedStartDraft(latestDraft);
      }
    }
    void queuedTurns.resume();
  }, [aiChatService, queuedTurns]);

  const handleCancelInitialStart = React.useCallback(() => {
    void queuedTurns.cancelInitialStart().then((result) => {
      if (result.accepted) {
        mainInputHandleRef.current?.focus?.();
      }
    });
  }, [queuedTurns]);

  const handleCloseChatView = React.useCallback(() => {
    aiChatService.updateInputDraft(chatInputRegistry.preserveActiveDraft() || aiChatService.getInputDraft());
    panelLayoutService.hideAIChatView();
  }, [aiChatService, chatInputRegistry, panelLayoutService]);

  const HeaderRender: ChatViewHeaderRender = chatRenderRegistry.chatViewHeaderRender || DefaultChatViewHeaderACP;

  const renderAgenticHistoryMessage = React.useCallback(
    (msg: Readonly<IHistoryChatMessage>) => {
      const relationId = msg.relationId || msg.id;
      const visibleAgentId = msg.agentId === ChatProxyService.AGENT_ID ? '' : msg.agentId;
      if (msg.role === ChatMessageRole.User) {
        const ChatUserRoleRender = chatRenderRegistry.chatUserRoleRender;
        return createMessageByUser(
          {
            id: msg.id,
            relationId,
            text: ChatUserRoleRender ? (
              <ChatUserRoleRender
                content={msg.content}
                images={msg.images}
                agentId={visibleAgentId}
                command={msg.agentCommand}
              />
            ) : (
              <CodeBlockWrapperInput
                labelService={labelService}
                relationId={relationId}
                text={msg.content}
                images={msg.images}
                agentId={visibleAgentId}
                command={msg.agentCommand}
                workspaceService={workspaceService}
                commandService={commandService}
              />
            ),
          },
          styles.chat_message_code,
        );
      }

      const request = msg.requestId ? aiChatService.sessionModel?.getRequest(msg.requestId) : undefined;
      if (request) {
        const commandHandler = msg.agentCommand
          ? chatFeatureRegistry.getSlashCommandHandler(msg.agentCommand)
          : undefined;
        if (msg.agentId === ChatProxyService.AGENT_ID && commandHandler?.providerRender && msg.agentCommand) {
          return createMessageByAI({
            id: msg.id,
            relationId,
            className: styles.chat_with_more_actions,
            text: (
              <SlashCustomRender
                userMessage={msg.content}
                startTime={msg.replyStartTime || 0}
                relationId={relationId}
                requestId={request.requestId}
                renderContent={commandHandler.providerRender}
                command={msg.agentCommand}
                agentId={msg.agentId}
              />
            ),
          });
        }
        return createMessageByAI({
          id: msg.id,
          relationId,
          className: styles.chat_with_more_actions,
          text: (
            <ChatReply
              relationId={relationId}
              request={request}
              startTime={msg.replyStartTime || 0}
              agentId={visibleAgentId}
              command={msg.agentCommand}
              onDidChange={() => agenticMessageListRef.current?.maintainBottom()}
              history={msgHistoryManager!}
              onRegenerate={() => void aiChatService.sendRequest(request, true)}
              msgId={msg.id}
              collapseReasoningByDefault
            />
          ),
        });
      }

      if (msg.componentId) {
        return createMessageByAI(
          {
            id: msg.id,
            relationId,
            text: (
              <ChatNotify
                requestId={relationId}
                chunk={{ kind: 'component', component: msg.componentId, value: msg.componentValue }}
              />
            ),
          },
          styles.chat_notify,
        );
      }

      const ChatAIRoleRender = chatRenderRegistry.chatAIRoleRender;
      return createMessageByAI({
        id: msg.id,
        relationId,
        className: styles.chat_with_more_actions,
        text: ChatAIRoleRender ? (
          <ChatAIRoleRender content={msg.content} />
        ) : (
          <ChatMarkdown
            markdown={msg.content}
            fillInIncompleteTokens
            agentId={msg.agentId}
            command={msg.agentCommand}
          />
        ),
      });
    },
    [
      aiChatService,
      chatFeatureRegistry,
      chatRenderRegistry.chatAIRoleRender,
      chatRenderRegistry.chatUserRoleRender,
      commandService,
      labelService,
      msgHistoryManager,
      workspaceService,
    ],
  );

  const recover = React.useCallback(
    async (cancellationToken: CancellationToken) => {
      if (!msgHistoryManager) {
        return;
      }

      for (const msg of msgHistoryManager.getMessages()) {
        if (cancellationToken.isCancellationRequested) {
          return;
        }
        if (msg.role === ChatMessageRole.User) {
          await renderUserMessage({
            relationId: msg.relationId!,
            message: msg.content,
            agentId: msg.agentId,
            command: msg.agentCommand,
            images: msg.images,
          });
        } else if (msg.role === ChatMessageRole.Assistant && msg.requestId) {
          const request = aiChatService.sessionModel?.getRequest(msg.requestId)!;
          // 从storage恢复时，request为undefined
          if (request && !request.response.isComplete) {
            setChatLoading(true);
          }
          await renderReply({
            msgId: msg.id,
            relationId: msg.relationId!,
            message: msg.content,
            agentId: msg.agentId,
            command: msg.agentCommand,
            startTime: msg.replyStartTime!,
            request,
            history: msgHistoryManager,
          });
        } else if (msg.role === ChatMessageRole.Assistant && msg.content) {
          await renderSimpleMarkdownReply({
            relationId: msg.relationId!,
            chunk: msg.content,
          });
        } else if (msg.role === ChatMessageRole.Assistant && msg.componentId) {
          await renderCustomComponent({
            relationId: msg.relationId!,
            chunk: {
              kind: 'component',
              component: msg.componentId,
              value: msg.componentValue,
            },
          });
        }
      }
    },
    [msgHistoryManager, renderCustomComponent, renderReply, renderSimpleMarkdownReply, renderUserMessage],
  );

  const activeServiceSessionId = aiChatService.sessionModel?.sessionId;
  const pendingAgenticSessionId = aiChatService.getPendingAgenticSessionId();
  const activeAgenticLiveReadyStatus = aiChatService.getAgenticSessionLiveReadyStatus(activeServiceSessionId);
  const showAgenticConnectionStatus = isAgenticLayout && (sessionLoading || activeAgenticLiveReadyStatus !== 'ready');

  const syncAgenticConversation = React.useCallback(
    (sessionId: string, messages: IHistoryChatMessage[]) => {
      const cache = agenticConversationCacheRef.current;
      const cached = cache.get(sessionId);
      const isActive = liveSessionIdRef.current === sessionId;
      const isPending = aiChatService.getPendingAgenticSessionId() === sessionId;
      if (!cached && !isActive && !isPending) {
        return undefined;
      }
      const viewModel = updateAgenticConversationViewModel(sessionId, messages, cached);
      cache.set(viewModel);
      if (isActive) {
        setAgenticConversation(viewModel);
        setHasUserSentMessage(messages.some((message) => message.role === ChatMessageRole.User));
      }
      return viewModel;
    },
    [aiChatService],
  );

  React.useEffect(() => {
    const subscriptions = agenticConversationSubscriptionsRef.current;
    if (!isAgenticLayout) {
      subscriptions.forEach(({ disposable }) => disposable.dispose());
      subscriptions.clear();
      return;
    }

    const syncSubscriptions = () => {
      aiChatService.getSessions().forEach((session) => {
        const existingSubscription = subscriptions.get(session.sessionId);
        if (existingSubscription?.history === session.history) {
          return;
        }
        existingSubscription?.disposable.dispose();
        subscriptions.set(session.sessionId, {
          history: session.history,
          disposable: session.history.onMessageChange((messages) => {
            syncAgenticConversation(session.sessionId, messages);
          }),
        });
      });
    };

    syncSubscriptions();
    const sessionDisposable = aiChatService.onSessionModelChange(syncSubscriptions);
    return () => {
      sessionDisposable.dispose();
      subscriptions.forEach(({ disposable }) => disposable.dispose());
      subscriptions.clear();
    };
  }, [aiChatService, isAgenticLayout, syncAgenticConversation]);

  React.useEffect(() => {
    if (!isAgenticLayout || !activeServiceSessionId || !msgHistoryManager) {
      setAgenticConversation(undefined);
      return;
    }
    const cache = agenticConversationCacheRef.current;
    cache.protect(
      [activeServiceSessionId, pendingAgenticSessionId].filter((sessionId): sessionId is string => Boolean(sessionId)),
    );
    const syncConversation = (messages: IHistoryChatMessage[]) => {
      syncAgenticConversation(activeServiceSessionId, messages);
    };
    const messages = msgHistoryManager.getMessages();
    const cached = cache.get(activeServiceSessionId);
    if (cached && isAgenticConversationViewModelCurrent(cached, messages)) {
      setAgenticConversation(cached);
      setHasUserSentMessage(cached.messages.some((message) => message.role === ChatMessageRole.User));
    } else {
      syncConversation(messages);
    }
  }, [activeServiceSessionId, isAgenticLayout, msgHistoryManager, pendingAgenticSessionId, syncAgenticConversation]);

  React.useEffect(() => {
    queuedTurns.activate(activeServiceSessionId);
    mainInputHandleRef.current?.setExpanded?.(false);
    queuedTurnSessionRef.current = activeServiceSessionId;
    manuallyCollapsedQueueRef.current = false;
    previousQueuedTurnCountRef.current = 0;
    setQueuedTurnsExpanded(true);
  }, [activeServiceSessionId, queuedTurns]);

  React.useEffect(() => {
    if (isAgenticLayout) {
      setChatLoading(false);
      return;
    }
    // 尝试重新渲染历史记录
    clearChatContent();
    setHasUserSentMessage(false);
    const cancellationTokenSource = new CancellationTokenSource();
    setChatLoading(false);
    void recover(cancellationTokenSource.token);
    return () => {
      cancellationTokenSource.cancel();
    };
  }, [aiChatService.sessionModel, isAgenticLayout, msgHistoryManager, recover]);

  React.useEffect(() => {
    const sessionModel = aiChatService.sessionModel;
    if (!sessionModel) {
      return;
    }

    const syncLoadingWithThreadStatus = () => {
      setChatLoading(isAcpResponsePending(sessionModel.threadStatus));
    };
    const disposable = sessionModel.onThreadStatusChange(syncLoadingWithThreadStatus);
    syncLoadingWithThreadStatus();
    return () => disposable.dispose();
  }, [aiChatService.sessionModel, setChatLoading]);

  const welcomePageRender = chatRenderRegistry.chatWelcomePageRender;
  const visibleMessageCount = isAgenticLayout ? agenticConversation?.messages.length || 0 : messageListData.length;
  const showWelcomePage =
    !hasUserSentMessage && visibleMessageCount <= (isAgenticLayout ? 0 : 1) && !!welcomePageRender;
  const showAgenticTaskEmptyState = showWelcomePage && panelLayoutService.getLayoutMode() === 'agentic';
  const showBlockingSessionLoading = sessionLoading && !isAgenticLayout;
  const welcomePage =
    showWelcomePage && welcomePageRender
      ? React.createElement(welcomePageRender, {
          onSend: handleSend,
          agentId,
          setAgentId,
          command,
          setCommand,
        })
      : undefined;

  return (
    <div id={styles.ai_chat_view}>
      <div className={styles.header_container}>
        <HeaderRender
          handleClear={handleClear}
          handleCloseChatView={handleCloseChatView}
          sessionModel={aiChatService.sessionModel}
        ></HeaderRender>
      </div>
      <div className={styles.body_container}>
        <div className={styles.left_bar} id='ai_chat_left_container'>
          <AgenticChatPanelHeader preferSessionTitle={true} sessionModel={aiChatService.sessionModel} />
          <div aria-busy={sessionLoading} className={styles.chat_container} ref={containerRef}>
            {showBlockingSessionLoading ? (
              <div
                aria-live='polite'
                className={styles.loading_container}
                data-testid='acp-session-loading'
                role='status'
              >
                {localize('aiNative.chat.session.loading', 'Loading chat…')}
              </div>
            ) : showWelcomePage ? (
              showAgenticTaskEmptyState ? (
                <div className={styles.agentic_task_empty_layout}>
                  <div className={styles.agentic_task_empty_content}>{welcomePage}</div>
                </div>
              ) : (
                welcomePage
              )
            ) : isAgenticLayout && agenticConversation && activeServiceSessionId ? (
              <AgenticVirtualMessageList
                key={activeServiceSessionId}
                ref={agenticMessageListRef}
                className={styles.message_list}
                messages={agenticConversation.messages}
                renderMessage={renderAgenticHistoryMessage}
                sessionId={activeServiceSessionId}
              />
            ) : (
              <MessageList
                className={styles.message_list}
                lockable={true}
                toBottomHeight={'100%'}
                // @ts-ignore
                dataSource={messageListData}
              />
            )}
          </div>
          {!sessionLoading && aiChatService.sessionModel?.slicedMessageCount ? (
            <div className={styles.chat_tips_text}>
              <div className={styles.chat_tips_container}>
                {formatLocalize(
                  'aiNative.chat.ai.assistant.limit.message',
                  aiChatService.sessionModel?.slicedMessageCount,
                )}
              </div>
            </div>
          ) : null}
          <div className={styles.chat_input_wrap}>
            {showAgenticConnectionStatus && (
              <div aria-live='polite' data-testid='acp-live-connecting' role='status'>
                {activeAgenticLiveReadyStatus === 'failed'
                  ? localize('aiNative.chat.session.connectionUnavailable', 'Connection unavailable')
                  : localize('aiNative.chat.session.restoringConnection', 'Restoring connection…')}
              </div>
            )}
            <AcpQueuedTurns
              snapshot={queuedTurnSnapshot}
              expanded={queuedTurnsExpanded}
              disabled={showBlockingSessionLoading}
              capabilities={activeChatInput?.capabilities || []}
              QueuedEditor={activeChatInput?.queuedTurnEditor}
              onToggleExpanded={handleQueuedTurnsToggle}
              onResume={handleQueuedTurnsResume}
              onClear={handleQueuedTurnClear}
              onBeginEdit={handleQueuedTurnEdit}
              onCommitEdit={handleQueuedTurnCommit}
              onCancelEdit={handleQueuedTurnCancel}
              onDelete={(id) => void handleQueuedTurnDelete(id)}
              onImmediateSend={(id) => void handleQueuedTurnImmediate(id)}
              onEditorReady={handleQueuedEditorReady}
              onOpenCapacitySettings={() =>
                void commandService.executeCommand(
                  COMMON_COMMANDS.OPEN_PREFERENCES.id,
                  AINativeSettingSectionsId.AcpThreadPoolSize,
                )
              }
              onCancelInitialStart={handleCancelInitialStart}
            />
            <div className={styles.header_operate}>
              {/* 定制需求。不需要透出shortcut*/}
              {/* <div className={styles.header_operate_left}>
                {shortcutCommands.map((command) => (
                  <Popover
                    id={`ai-chat-shortcut-${command.name}`}
                    key={`ai-chat-shortcut-${command.name}`}
                    title={command.tooltip || command.name}
                  >
                    <div className={styles.tag} onClick={() => handleShortcutCommandClick(command)}>
                      {command.name}
                    </div>
                  </Popover>
                ))}
              </div>*/}
            </div>
            {changeList.length > 0 && (
              <FileListDisplay
                files={changeList}
                hideActions={loading || sessionLoading}
                onFileClick={(filePath) => {
                  editorService.open(URI.file(path.join(appConfig.workspaceDir, filePath)));
                }}
                onRejectAll={() => {
                  applyService.processAll('reject');
                }}
                onAcceptAll={() => {
                  applyService.processAll('accept');
                }}
              />
            )}
            <ChatInputWrapperRender
              onSend={handleSend}
              initialDraft={aiChatService.getInputDraft()}
              onDraftChange={(draft) => aiChatService.updateInputDraft(draft)}
              disabled={showBlockingSessionLoading}
              submitDisabled={showAgenticConnectionStatus}
              loading={loading}
              enableOptions={true}
              theme={theme}
              setTheme={setTheme}
              agentId={agentId}
              setAgentId={setAgentId}
              defaultAgentId={defaultAgentId}
              command={command}
              setCommand={setCommand}
              contextService={llmContextService}
              ref={handleChatInputRef}
              disableModelSelector={
                aiNativeConfigService.capabilities.supportsAgentMode
                  ? loading || sessionLoading
                  : sessionModelId !== undefined || loading || sessionLoading
              }
              activeSessionId={activeServiceSessionId}
              sessionModelId={sessionModelId}
              agentModes={footerAgentModes}
              currentModeId={footerCurrentModeId}
              agentModels={footerAgentModels}
              currentModelId={footerCurrentModelId}
              configOptions={footerConfigOptions}
              agentCwd={appConfig.workspaceDir}
              turnActions={turnActions}
              onInputHandleReady={handleActiveInputReady}
              placeholder={localize('aiNative.chat.input.placeholder.acp')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export function DefaultChatViewHeaderACP({
  handleCloseChatView,
}: {
  handleClear: () => any;
  handleCloseChatView: () => any;
}) {
  const aiChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const permissionBridgeService = useInjectable<AcpPermissionBridgeService>(AcpPermissionBridgeService);
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);
  const commandService = useInjectable<CommandService>(CommandService);

  const [historyList, setHistoryList] = React.useState<IChatHistoryItem[]>([]);
  const [currentTitle, setCurrentTitle] = React.useState<string>('');
  const [pendingPermissionBadge, setPendingPermissionBadge] = React.useState(0);
  const [panelLayout, setPanelLayout] = React.useState(() => panelLayoutService.getLayoutMode());

  React.useEffect(() => {
    setPanelLayout(panelLayoutService.getLayoutMode());
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setPanelLayout(mode);
    });
    return () => disposable.dispose();
  }, [panelLayoutService]);

  const handleNewChat = React.useCallback(() => {
    void commandService.executeCommand(AI_CHAT_NEW_CHAT.id);
  }, [commandService]);
  const handleHistoryItemSelect = React.useCallback(
    (item: IChatHistoryItem) => {
      aiChatService.activateSession(item.id);
    },
    [aiChatService],
  );
  const handleHistoryItemDelete = React.useCallback(
    (item: IChatHistoryItem) => {
      aiChatService.clearSessionModel(item.id);
    },
    [aiChatService],
  );

  // 生成摘要
  const getSummary = React.useCallback(
    async (
      messages: { role: ChatMessageRole; content: string }[],
      currentTitle: string,
      summaryProvider: any,
    ): Promise<string> => {
      if (!summaryProvider) {
        return currentTitle;
      }

      try {
        const summary = await summaryProvider.getMessageSummary(messages);
        return summary ? summary.slice(0, MAX_TITLE_LENGTH) : currentTitle;
      } catch (error) {
        return currentTitle;
      }
    },
    [],
  );

  // 使用 ref 来跟踪最新的请求
  const latestSummaryRequestRef = React.useRef<number>(0);

  React.useEffect(() => {
    const toDispose = new DisposableCollection();
    const sessionListenIds = new Set<string>();
    const subscribedSessionIds = new Set<string>();

    const subscribeThreadStatus = (model: ChatModel) => {
      if (subscribedSessionIds.has(model.sessionId)) {
        return;
      }
      subscribedSessionIds.add(model.sessionId);
      toDispose.push(
        model.onThreadStatusChange((status) => {
          setHistoryList((prev) =>
            prev.map((item) => (item.id === model.sessionId ? { ...item, threadStatus: status } : item)),
          );
        }),
      );
    };

    const getHistoryList = async () => {
      const currentMessages = aiChatService.sessionModel?.history.getMessages() || [];
      const latestUserMessage = [...currentMessages].find((m) => m.role === ChatMessageRole.User);
      const currentTitle =
        aiChatService.sessionModel?.title?.slice(0, MAX_TITLE_LENGTH) ||
        (latestUserMessage ? cleanAttachedTextWrapper(latestUserMessage.content).slice(0, MAX_TITLE_LENGTH) : '');

      // 设置初始标题
      setCurrentTitle(currentTitle);

      const messages = currentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // 只有当消息数量超过阈值时才生成摘要
      if (messages.length > 2) {
        const requestId = Date.now();
        latestSummaryRequestRef.current = requestId;

        const summaryProvider = chatFeatureRegistry.getMessageSummaryProvider();
        const summary = await getSummary(messages, currentTitle, summaryProvider);

        // 检查是否是最新请求
        if (requestId === latestSummaryRequestRef.current && summary) {
          setCurrentTitle(summary);
        }
      }

      const sessions = getVisibleAcpSessions(aiChatService);
      for (const session of sessions) {
        subscribeThreadStatus(session);
      }

      setHistoryList(
        sessions.map((session) => {
          const history = session.history;
          const messages = history.getMessages();
          const messageTitle =
            messages.length > 0 ? cleanAttachedTextWrapper(messages[0].content).slice(0, MAX_TITLE_LENGTH) : '';
          const title = session.title || messageTitle;
          const createdAt = getSessionCreatedAt(session);
          return {
            id: session.sessionId,
            title,
            createdAt,
            loading: false,
            threadStatus: session.threadStatus,
            hasPendingPermission: permissionBridgeService.hasPendingForSession(session.sessionId),
          };
        }),
      );
    };
    getHistoryList();

    // Subscribe to pending permission count changes
    const refreshBadge = () => {
      setPendingPermissionBadge(permissionBridgeService.getPendingCountExcludingActive());
    };
    toDispose.push(
      permissionBridgeService.onPendingCountChange(() => {
        refreshBadge();
        getHistoryList();
      }),
    );
    toDispose.push(
      permissionBridgeService.onActiveSessionChange(() => {
        refreshBadge();
      }),
    );
    refreshBadge();

    toDispose.push(
      aiChatService.onChangeSession((sessionId) => {
        getHistoryList();
        if (sessionListenIds.has(sessionId)) {
          return;
        }
        sessionListenIds.add(sessionId);
        const history = aiChatService.sessionModel?.history;
        if (history) {
          toDispose.push(
            history.onMessageChange(() => {
              getHistoryList();
            }),
          );
        }
      }),
    );
    const activeHistory = aiChatService.sessionModel?.history;
    if (activeHistory) {
      toDispose.push(
        activeHistory.onMessageChange(() => {
          getHistoryList();
        }),
      );
    }
    return () => {
      toDispose.dispose();
    };
  }, [aiChatService]);

  return (
    <div className={styles.header}>
      <ChatHistory
        className={styles.chat_history}
        currentId={aiChatService.sessionModel?.sessionId}
        title={currentTitle || localize('aiNative.chat.ai.assistant.name')}
        historyList={historyList}
        pendingPermissionBadge={pendingPermissionBadge}
        onNewChat={handleNewChat}
        onHistoryItemSelect={handleHistoryItemSelect}
        onHistoryItemDelete={handleHistoryItemDelete}
        onHistoryItemChange={() => {}}
      />
      <AgenticChatHeaderMaximizeAction />
      {panelLayout !== 'agentic' && (
        <Popover
          overlayClassName={styles.popover_icon}
          id={'ai-chat-header-close'}
          position={PopoverPosition.left}
          title={localize('aiNative.operate.close.title')}
        >
          <EnhanceIcon
            wrapperClassName={styles.action_btn}
            className={getIcon('window-close')}
            onClick={handleCloseChatView}
            tabIndex={0}
            role='button'
            ariaLabel={localize('aiNative.operate.close.title')}
          />
        </Popover>
      )}
    </div>
  );
}
