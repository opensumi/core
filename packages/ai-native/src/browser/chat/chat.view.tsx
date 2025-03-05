import * as React from 'react';
import { MessageList } from 'react-chat-elements';

import { getIcon, useInjectable, useUpdateOnEvent } from '@opensumi/ide-core-browser';
import { Popover, PopoverPosition } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import {
  AIServiceType,
  ActionSourceEnum,
  ActionTypeEnum,
  CancellationToken,
  CancellationTokenSource,
  ChatFeatureRegistryToken,
  ChatMessageRole,
  ChatRenderRegistryToken,
  ChatServiceToken,
  Disposable,
  DisposableCollection,
  IAIReporter,
  IChatComponent,
  IChatContent,
  formatLocalize,
  localize,
  uuid,
} from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IMessageService } from '@opensumi/ide-overlay';

import 'react-chat-elements/dist/main.css';
import { AI_CHAT_VIEW_ID, IChatAgentService, IChatInternalService, IChatMessageStructure } from '../../common';
import { ChatContext } from '../components/ChatContext';
import { CodeBlockWrapperInput } from '../components/ChatEditor';
import ChatHistory, { IChatHistoryItem } from '../components/ChatHistory';
import { ChatInput } from '../components/ChatInput';
import { ChatMarkdown } from '../components/ChatMarkdown';
import { ChatNotify, ChatReply } from '../components/ChatReply';
import { SlashCustomRender } from '../components/SlashCustomRender';
import { MessageData, createMessageByAI, createMessageByUser } from '../components/utils';
import { WelcomeMessage } from '../components/WelcomeMsg';
import { ChatViewHeaderRender, IMCPServerRegistry, TSlashCommandCustomRender, TokenMCPServerRegistry } from '../types';

import { ChatRequestModel, ChatSlashCommandItemModel } from './chat-model';
import { ChatProxyService } from './chat-proxy.service';
import { ChatService } from './chat.api.service';
import { ChatFeatureRegistry } from './chat.feature.registry';
import { ChatInternalService } from './chat.internal.service';
import styles from './chat.module.less';
import { ChatRenderRegistry } from './chat.render.registry';

const SCROLL_CLASSNAME = 'chat_scroll';

interface TDispatchAction {
  type: 'add' | 'clear' | 'init';
  payload?: MessageData[];
}

const MAX_TITLE_LENGTH = 100;

export const AIChatView = () => {
  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const chatApiService = useInjectable<ChatService>(ChatServiceToken);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);
  const mcpServerRegistry = useInjectable<IMCPServerRegistry>(TokenMCPServerRegistry);

  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const msgHistoryManager = aiChatService.sessionModel.history;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const autoScroll = React.useRef<boolean>(true);
  const chatInputRef = React.useRef<{ setInputValue: (v: string) => void } | null>(null);

  const [shortcutCommands, setShortcutCommands] = React.useState<ChatSlashCommandItemModel[]>([]);

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
  const [agentId, setAgentId] = React.useState('');
  const [defaultAgentId, setDefaultAgentId] = React.useState<string>('');
  const [command, setCommand] = React.useState('');
  const [theme, setTheme] = React.useState<string | null>(null);

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

  const ChatInputWrapperRender = React.useMemo(() => {
    if (chatRenderRegistry.chatInputRender) {
      return chatRenderRegistry.chatInputRender;
    }
    return ChatInput;
  }, [chatRenderRegistry.chatInputRender]);

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
          if (loading) {
            return;
          }
          await handleSend(message);
        } else {
          if (message.agentId) {
            setAgentId(message.agentId);
          }
          if (message.command) {
            setCommand(message.command);
          }
          chatInputRef?.current?.setInputValue(message.message);
        }
      }),
    );

    disposer.addDispose(
      chatApiService.onChatReplyMessageLaunch((data) => {
        if (data.kind === 'content') {
          const relationId = aiReporter.start(AIServiceType.CustomReply, {
            message: data.content,
            sessionId: aiChatService.sessionModel.sessionId,
          });
          msgHistoryManager.addAssistantMessage({
            content: data.content,
            relationId,
          });
          renderSimpleMarkdownReply({ chunk: data.content, relationId });
        } else {
          const relationId = aiReporter.start(AIServiceType.CustomReply, {
            message: 'component#' + data.component,
            sessionId: aiChatService.sessionModel.sessionId,
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
            sessionId: aiChatService.sessionModel.sessionId,
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
  }, [chatApiService, chatRenderRegistry.chatAIRoleRender, msgHistoryManager]);

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
      command?: string;
      agentId?: string;
    }) => {
      const { userMessage, relationId, requestId, render, startTime, command, agentId } = value;

      msgHistoryManager.addAssistantMessage({
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
    [containerRef, msgHistoryManager],
  );

  const renderUserMessage = React.useCallback(
    async (renderModel: { message: string; agentId?: string; relationId: string; command?: string }) => {
      const ChatUserRoleRender = chatRenderRegistry.chatUserRoleRender;

      const { message, agentId, relationId, command } = renderModel;

      const visibleAgentId = agentId === ChatProxyService.AGENT_ID ? '' : agentId;

      const userMessage = createMessageByUser(
        {
          id: uuid(6),
          relationId,
          text: ChatUserRoleRender ? (
            <ChatUserRoleRender content={message} agentId={visibleAgentId} command={command} />
          ) : (
            <CodeBlockWrapperInput relationId={relationId} text={message} agentId={visibleAgentId} command={command} />
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
    }) => {
      const { message, agentId, request, relationId, command, startTime, msgId } = renderModel;

      const visibleAgentId = agentId === ChatProxyService.AGENT_ID ? '' : agentId;

      if (agentId === ChatProxyService.AGENT_ID && command) {
        const commandHandler = chatFeatureRegistry.getSlashCommandHandler(command);
        if (commandHandler && commandHandler.providerRender) {
          setLoading(false);
          return handleSlashCustomRender({
            userMessage: message,
            render: commandHandler.providerRender,
            relationId,
            requestId: request.requestId,
            startTime,
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
            history={msgHistoryManager}
            onDone={() => {
              setLoading(false);
            }}
            onRegenerate={() => {
              if (request) {
                aiChatService.sendRequest(request, true);
              }
            }}
            msgId={msgId}
          />
        ),
      });
      handleDispatchMessage({ type: 'add', payload: [aiMessage] });
    },
    [chatRenderRegistry, msgHistoryManager, scrollToBottom],
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
    async (value: IChatMessageStructure) => {
      const { message, agentId, command, reportExtra } = value;
      const { actionType, actionSource } = reportExtra || {};

      const request = aiChatService.createRequest(message, agentId!, command);
      if (!request) {
        return;
      }

      setLoading(true);
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
          sessionId: aiChatService.sessionModel.sessionId,
        },
        // 由于涉及 tool 调用，超时时间设置长一点
        600 * 1000,
      );

      msgHistoryManager.addUserMessage({
        content: message,
        agentId: agentId!,
        agentCommand: command!,
        relationId,
      });

      await renderUserMessage({
        relationId,
        message,
        command,
        agentId,
      });

      aiChatService.sendRequest(request);

      const msgId = msgHistoryManager.addAssistantMessage({
        content: '',
        relationId,
        requestId: request.requestId,
        replyStartTime: startTime,
      });

      // 创建消息时，设置当前活跃的消息信息，便于toolCall打点
      mcpServerRegistry.activeMessageInfo = {
        messageId: msgId,
        sessionId: aiChatService.sessionModel.sessionId,
      };

      await renderReply({
        startTime,
        relationId,
        message,
        agentId,
        command,
        request,
        msgId,
      });
    },
    [chatRenderRegistry, chatRenderRegistry.chatUserRoleRender, msgHistoryManager, scrollToBottom],
  );

  const handleSend = React.useCallback(
    async (value: IChatMessageStructure) => {
      const { message, command, reportExtra } = value;

      const agentId = value.agentId ? value.agentId : ChatProxyService.AGENT_ID;
      return handleAgentReply({ message, agentId, command, reportExtra });
    },
    [handleAgentReply],
  );

  const handleClear = React.useCallback(() => {
    aiChatService.clearSessionModel();
    chatApiService.clearHistoryMessages();
    clearChatContent();
  }, [messageListData]);

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

  const handleCloseChatView = React.useCallback(() => {
    layoutService.toggleSlot(AI_CHAT_VIEW_ID);
  }, [layoutService]);

  const HeaderRender: ChatViewHeaderRender = chatRenderRegistry.chatViewHeaderRender || DefaultChatViewHeader;

  const recover = React.useCallback(
    async (cancellationToken: CancellationToken) => {
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
          });
        } else if (msg.role === ChatMessageRole.Assistant && msg.requestId) {
          const request = aiChatService.sessionModel.getRequest(msg.requestId)!;
          // 从storage恢复时，request为undefined
          if (request && !request.response.isComplete) {
            setLoading(true);
          }
          await renderReply({
            msgId: msg.id,
            relationId: msg.relationId!,
            message: msg.content,
            agentId: msg.agentId,
            command: msg.agentCommand,
            startTime: msg.replyStartTime!,
            request,
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
    [renderReply],
  );

  React.useEffect(() => {
    // 尝试重新渲染历史记录
    clearChatContent();
    const cancellationTokenSource = new CancellationTokenSource();
    setLoading(false);
    recover(cancellationTokenSource.token);
    return () => {
      cancellationTokenSource.cancel();
    };
  }, [aiChatService.sessionModel]);

  return (
    <div id={styles.ai_chat_view}>
      <div className={styles.header_container}>
        <HeaderRender handleClear={handleClear} handleCloseChatView={handleCloseChatView}></HeaderRender>
      </div>
      <div className={styles.body_container}>
        <div className={styles.left_bar} id='ai_chat_left_container'>
          <div className={styles.chat_container} ref={containerRef}>
            <MessageList
              className={styles.message_list}
              lockable={true}
              toBottomHeight={'100%'}
              // @ts-ignore
              dataSource={messageListData}
            />
          </div>
          {msgHistoryManager.slicedMessageCount ? (
            <div className={styles.chat_tips_text}>
              <div className={styles.chat_tips_container}>
                {formatLocalize('aiNative.chat.ai.assistant.limit.message', msgHistoryManager.slicedMessageCount)}
              </div>
            </div>
          ) : null}
          <div className={styles.chat_input_wrap}>
            <ChatContext />
            <div className={styles.header_operate}>
              <div className={styles.header_operate_left}>
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
              </div>
            </div>
            <ChatInputWrapperRender
              onSend={(value, agentId, command) =>
                handleSend({
                  message: value,
                  agentId,
                  command,
                  reportExtra: {
                    actionSource: ActionSourceEnum.Chat,
                    actionType: ActionTypeEnum.Send,
                  },
                })
              }
              disabled={loading}
              enableOptions={true}
              theme={theme}
              setTheme={setTheme}
              agentId={agentId}
              setAgentId={setAgentId}
              defaultAgentId={defaultAgentId}
              command={command}
              setCommand={setCommand}
              ref={chatInputRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export function DefaultChatViewHeader({
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
  const handleNewChat = React.useCallback(() => {
    if (aiChatService.sessionModel.history.getMessages().length > 0) {
      try {
        aiChatService.createSessionModel();
      } catch (error) {
        messageService.error(error.message);
      }
    }
  }, [aiChatService]);
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

  React.useEffect(() => {
    const getHistoryList = () => {
      const currentMessages = aiChatService.sessionModel.history.getMessages();
      setCurrentTitle(
        currentMessages.length > 0
          ? currentMessages[currentMessages.length - 1].content.slice(0, MAX_TITLE_LENGTH)
          : '',
      );
      setHistoryList(
        aiChatService.getSessions().map((session) => {
          const history = session.history;
          const messages = history.getMessages();
          const title = messages.length > 0 ? messages[0].content.slice(0, MAX_TITLE_LENGTH) : '';
          const updatedAt = messages.length > 0 ? messages[messages.length - 1].replyStartTime || 0 : 0;
          // const loading = session.requests[session.requests.length - 1]?.response.isComplete;
          return {
            id: session.sessionId,
            title,
            updatedAt,
            // TODO: 后续支持
            loading: false,
          };
        }),
      );
    };
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
        toDispose.push(
          aiChatService.sessionModel.history.onMessageChange(() => {
            getHistoryList();
          }),
        );
      }),
    );
    toDispose.push(
      aiChatService.sessionModel.history.onMessageChange(() => {
        getHistoryList();
      }),
    );
    return () => {
      toDispose.dispose();
    };
  }, [aiChatService]);

  return (
    <div className={styles.header}>
      <ChatHistory
        className={styles.chat_history}
        // 取对话名称
        currentId={aiChatService.sessionModel.sessionId}
        title={currentTitle || localize('aiNative.chat.ai.assistant.name')}
        historyList={historyList}
        onNewChat={handleNewChat}
        onHistoryItemSelect={handleHistoryItemSelect}
        onHistoryItemDelete={handleHistoryItemDelete}
        onHistoryItemChange={() => {}}
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
