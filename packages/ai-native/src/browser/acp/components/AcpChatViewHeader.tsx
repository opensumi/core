import React from 'react';

import { getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Popover, PopoverPosition } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ChatMessageRole, DisposableCollection, localize } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import { IChatInternalService } from '../../../common';
import { cleanAttachedTextWrapper } from '../../../common/utils';
import { ChatInternalService } from '../../chat/chat.internal.service';
import styles from '../../chat/chat.module.less';

import AcpChatHistory, { IChatHistoryItem } from './AcpChatHistory';

const MAX_TITLE_LENGTH = 100;

/**
 * ACP 专属的 ChatViewHeader
 * 与 DefaultChatViewHeader 的区别：
 * - 使用 session.title（服务端返回的标题）构建 historyList，而非从消息内容推导
 * - 不显示删除按钮（ACP 模式下由服务端管理会话生命周期）
 */
export function AcpChatViewHeader({
  handleClear,
  handleCloseChatView,
}: {
  handleClear: () => any;
  handleCloseChatView: () => any;
}) {
  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const messageService = useInjectable<IMessageService>(IMessageService);

  const [historyList, setHistoryList] = React.useState<IChatHistoryItem[]>([]);
  const [currentTitle, setCurrentTitle] = React.useState<string>('');
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [sessionSwitching, setSessionSwitching] = React.useState(false);

  React.useEffect(() => {
    const dispose = aiChatService.onSessionLoadingChange((loading) => {
      setSessionSwitching(loading);
    });
    return () => dispose.dispose();
  }, [aiChatService]);

  const handleNewChat = React.useCallback(() => {
    if (sessionSwitching) {
      return;
    }
    if (aiChatService.sessionModel && aiChatService.sessionModel.history.getMessages().length > 0) {
      try {
        aiChatService.createSessionModel();
      } catch (error) {
        messageService.error(error.message);
      }
    }
  }, [aiChatService, sessionSwitching]);

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

    const toDispose = new DisposableCollection();
    const sessionListenIds = new Set<string>();

    toDispose.push(
      aiChatService.onChangeSession((sessionId) => {
        getHistoryList();
        if (sessionListenIds.has(sessionId)) {
          return;
        }
        sessionListenIds.add(sessionId);
        if (aiChatService.sessionModel) {
          toDispose.push(
            aiChatService.sessionModel.history.onMessageChange(() => {
              getHistoryList();
            }),
          );
        }
      }),
    );

    if (aiChatService.sessionModel) {
      toDispose.push(
        aiChatService.sessionModel.history.onMessageChange(() => {
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
      <AcpChatHistory
        className={styles.chat_history}
        currentId={aiChatService.sessionModel?.sessionId}
        title={currentTitle || localize('aiNative.chat.ai.assistant.name')}
        historyList={historyList}
        historyLoading={historyLoading}
        disabled={sessionSwitching}
        onNewChat={handleNewChat}
        onHistoryItemSelect={handleHistoryItemSelect}
        onHistoryItemDelete={() => {}}
        onHistoryItemChange={handleHistoryItemChange}
        onHistoryPopoverVisibleChange={handleHistoryPopoverVisibleChange}
      />
      <Popover
        overlayClassName={styles.popover_icon}
        id={'ai-chat-header-clear'}
        title={localize('aiNative.operate.clear.title')}
      >
        <EnhanceIcon
          wrapperClassName={styles.action_btn}
          className={getIcon('clear')}
          onClick={handleClear}
          tabIndex={0}
          role='button'
          ariaLabel={localize('aiNative.operate.clear.title')}
        />
      </Popover>
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
    </div>
  );
}
