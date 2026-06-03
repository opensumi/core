import cls from 'classnames';
import React from 'react';

import { QuickPickService, getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Popover, PopoverPosition } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import {
  ChatMessageRole,
  DisposableCollection,
  IDisposable,
  formatLocalize,
  localize,
} from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IChatInternalService } from '../../../common';
import { cleanAttachedTextWrapper } from '../../../common/utils';
import { ChatModel } from '../../chat/chat-model';
import { ChatInternalService } from '../../chat/chat.internal.service';
import { AcpChatInternalService } from '../../chat/chat.internal.service.acp';
import styles from '../../chat/chat.module.less';
import { getCachedWorkspaceDir, switchWorkspaceDir } from '../../chat/pick-workspace-dir';
import { AIPanelLayoutService } from '../../layout/panel-layout.service';
import { AcpPermissionBridgeService } from '../permission-bridge.service';

import AcpChatHistory, { IChatHistoryItem } from './AcpChatHistory';

const MAX_TITLE_LENGTH = 100;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * ACP 专属的 ChatViewHeader
 * 与 DefaultChatViewHeader 的区别：
 * - 使用 session.title（服务端返回的标题）构建 historyList，而非从消息内容推导
 * - 不显示删除按钮（ACP 模式下由服务端管理会话生命周期）
 */
export function AcpChatViewHeader({ handleCloseChatView }: { handleClear: () => any; handleCloseChatView: () => any }) {
  const aiChatService = useInjectable<AcpChatInternalService>(IChatInternalService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const quickPick = useInjectable<QuickPickService>(QuickPickService);
  const permissionBridgeService = useInjectable<AcpPermissionBridgeService>(AcpPermissionBridgeService);
  const panelLayoutService = useInjectable<AIPanelLayoutService>(AIPanelLayoutService);

  const [historyList, setHistoryList] = React.useState<IChatHistoryItem[]>([]);
  const [currentTitle, setCurrentTitle] = React.useState<string>('');
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [sessionSwitching, setSessionSwitching] = React.useState(false);
  const [pendingPermissionBadge, setPendingPermissionBadge] = React.useState(0);
  const [panelLayout, setPanelLayout] = React.useState(() => panelLayoutService.getLayoutMode());
  const [historyCollapsed, setHistoryCollapsed] = React.useState(false);
  const isMultiRoot = workspaceService.isMultiRootWorkspaceOpened;

  const subscribedSessionIdsRef = React.useRef<Set<string>>(new Set());
  const toDisposeRef = React.useRef<DisposableCollection>(new DisposableCollection());
  const sessionSwitchingRef = React.useRef(false);

  const [currentWorkspaceDir, setCurrentWorkspaceDir] = React.useState<string>(getCachedWorkspaceDir());

  const createSessionModel = React.useCallback(
    async ({ skipEmptySession = true }: { skipEmptySession?: boolean } = {}) => {
      if (sessionSwitchingRef.current) {
        return;
      }

      if (skipEmptySession) {
        const currentMessages = aiChatService.sessionModel?.history.getMessages() || [];
        if (currentMessages.length === 0) {
          return;
        }
      }

      sessionSwitchingRef.current = true;
      setSessionSwitching(true);
      try {
        await aiChatService.createSessionModel();
      } catch (error) {
        messageService.error(getErrorMessage(error));
      } finally {
        sessionSwitchingRef.current = false;
        setSessionSwitching(false);
      }
    },
    [aiChatService, messageService],
  );

  // Sync state when cache is updated externally (e.g. by session provider on first init)
  React.useEffect(() => {
    const cached = getCachedWorkspaceDir();
    if (cached && cached !== currentWorkspaceDir) {
      setCurrentWorkspaceDir(cached);
    }
  });

  const handleSwitchWorkspaceDir = React.useCallback(async () => {
    const oldDir = getCachedWorkspaceDir();
    const newDir = await switchWorkspaceDir(workspaceService, quickPick, messageService);
    setCurrentWorkspaceDir(newDir);
    // Create new session with new cwd if path actually changed
    if (newDir && newDir !== oldDir) {
      await createSessionModel({ skipEmptySession: false });
    }
  }, [workspaceService, quickPick, messageService, createSessionModel]);

  React.useEffect(() => {
    const dispose = aiChatService.onSessionLoadingChange((loading) => {
      sessionSwitchingRef.current = loading;
      setSessionSwitching(loading);
    });
    return () => dispose.dispose();
  }, [aiChatService]);

  React.useEffect(() => {
    const disposable = panelLayoutService.onDidChangePanelLayout((mode) => {
      setPanelLayout(mode);
    });
    setPanelLayout(panelLayoutService.getLayoutMode());

    return () => disposable.dispose();
  }, [panelLayoutService]);

  const handleNewChat = React.useCallback(() => {
    createSessionModel();
  }, [createSessionModel]);

  const handleHistoryItemSelect = React.useCallback(
    (item: IChatHistoryItem) => {
      if (sessionSwitching) {
        return;
      }
      aiChatService.activateSession(item.id);
    },
    [aiChatService, sessionSwitching],
  );

  const handleHistoryItemChange = React.useCallback(() => {}, []);

  /**
   * 构建 ACP 历史列表
   * 优先使用 session.title（服务端元数据），降级使用第一条消息内容
   */
  const getHistoryList = React.useCallback(async () => {
    const sessions = aiChatService.getSessions();

    // Subscribe to thread status changes for any new sessions
    for (const session of sessions) {
      const model = session as ChatModel;
      if (!subscribedSessionIdsRef.current.has(model.sessionId)) {
        subscribedSessionIdsRef.current.add(model.sessionId);
        toDisposeRef.current.push(
          model.onThreadStatusChange((status) => {
            setHistoryList((prev) =>
              prev.map((item) => (item.id === model.sessionId ? { ...item, threadStatus: status } : item)),
            );
          }),
        );
      }
    }

    // 当前会话标题
    const currentMessages = aiChatService.sessionModel?.history.getMessages() || [];
    const latestUserMessage = [...currentMessages].find((m) => m.role === ChatMessageRole.User);
    const title = latestUserMessage
      ? cleanAttachedTextWrapper(latestUserMessage.content).slice(0, MAX_TITLE_LENGTH)
      : '';
    setCurrentTitle(title);

    setHistoryList(
      sessions.map((session) => {
        const messages = session.history.getMessages();

        // ACP 关键区别：优先使用 session.title
        let sessionTitle = '';
        if (session.title) {
          sessionTitle = session.title.slice(0, MAX_TITLE_LENGTH);
        } else if (messages.length > 0) {
          sessionTitle = cleanAttachedTextWrapper(messages[0].content).slice(0, MAX_TITLE_LENGTH);
        }

        const updatedAt = messages.length > 0 ? messages[messages.length - 1].replyStartTime || 0 : 0;

        return {
          id: session.sessionId,
          title: sessionTitle,
          updatedAt,
          loading: false,
          threadStatus: (session as ChatModel).threadStatus,
          hasPendingPermission: permissionBridgeService.hasPendingForSession(session.sessionId),
        };
      }),
    );
  }, [aiChatService]);

  // 监听 popover 打开时刷新列表
  const handleHistoryPopoverVisibleChange = React.useCallback(
    async (visible: boolean) => {
      if (visible) {
        setHistoryLoading(true);
        try {
          await aiChatService.getSessionsByAcp();
          await getHistoryList();
        } finally {
          setHistoryLoading(false);
        }
      }
    },
    [aiChatService, getHistoryList],
  );

  React.useEffect(() => {
    getHistoryList();

    const toDispose = toDisposeRef.current;
    let previousMessageChangeDisposable: IDisposable | undefined;

    const refreshBadge = () => {
      setPendingPermissionBadge(permissionBridgeService.getPendingCountExcludingActive());
    };
    refreshBadge();
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

    toDispose.push(
      aiChatService.onChangeSession(() => {
        getHistoryList();
        previousMessageChangeDisposable?.dispose();
        if (aiChatService.sessionModel) {
          previousMessageChangeDisposable = aiChatService.sessionModel.history.onMessageChange(() => {
            getHistoryList();
          });
        }
      }),
    );

    toDispose.push({ dispose: () => previousMessageChangeDisposable?.dispose() });

    if (aiChatService.sessionModel) {
      toDispose.push(
        aiChatService.sessionModel.history.onMessageChange(() => {
          getHistoryList();
        }),
      );
    }

    return () => {
      toDispose.dispose();
      subscribedSessionIdsRef.current.clear();
    };
  }, [aiChatService]);

  const isAgenticLayout = panelLayout === 'agentic';

  React.useEffect(() => {
    if (!isAgenticLayout) {
      setHistoryCollapsed(false);
    }
  }, [isAgenticLayout]);

  const handleToggleHistoryCollapsed = React.useCallback(() => {
    setHistoryCollapsed((collapsed) => !collapsed);
  }, []);

  return (
    <div className={cls(styles.header, isAgenticLayout && styles.header_agentic)}>
      <AcpChatHistory
        className={cls(
          styles.chat_history,
          isAgenticLayout && styles.chat_history_agentic,
          isAgenticLayout && historyCollapsed && styles.chat_history_agentic_collapsed,
        )}
        currentId={aiChatService.sessionModel?.sessionId}
        title={currentTitle || localize('aiNative.chat.ai.assistant.name')}
        historyList={historyList}
        variant={isAgenticLayout ? 'inline' : 'popover'}
        historyLoading={historyLoading}
        historyCollapsed={isAgenticLayout && historyCollapsed}
        disabled={sessionSwitching}
        pendingPermissionBadge={pendingPermissionBadge}
        onNewChat={handleNewChat}
        onToggleHistoryCollapsed={isAgenticLayout ? handleToggleHistoryCollapsed : undefined}
        onHistoryItemSelect={handleHistoryItemSelect}
        onHistoryItemDelete={() => {}}
        onHistoryItemChange={handleHistoryItemChange}
        onHistoryPopoverVisibleChange={handleHistoryPopoverVisibleChange}
      />
      {isMultiRoot && (
        <Popover
          key={`switch-cwd-${currentWorkspaceDir}`}
          overlayClassName={styles.popover_icon}
          id={'ai-chat-header-switch-cwd'}
          title={
            currentWorkspaceDir
              ? formatLocalize('chat.switchWorkspaceDirHint', currentWorkspaceDir)
              : localize('chat.switchWorkspaceDir')
          }
        >
          <EnhanceIcon
            wrapperClassName={styles.action_btn}
            className={getIcon('folder')}
            onClick={handleSwitchWorkspaceDir}
            tabIndex={0}
            role='button'
            ariaLabel={localize('chat.switchWorkspaceDir')}
          />
        </Popover>
      )}
      {!isAgenticLayout && (
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
