import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { MessageList } from 'react-chat-elements';

import { getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Popover, PopoverPosition } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import {
  AISerivceType,
  ChatFeatureRegistryToken,
  ChatRenderRegistryToken,
  ChatServiceToken,
  Disposable,
  IAIReporter,
  localize,
  uuid,
} from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import 'react-chat-elements/dist/main.css';
import { AI_CHAT_VIEW_ID, IChatAgentService, IChatInternalService, IChatMessageStructure } from '../../common';
import { CodeBlockWrapperInput } from '../components/ChatEditor';
import { ChatInput } from '../components/ChatInput';
import { ChatMarkdown } from '../components/ChatMarkdown';
import { ChatNotify, ChatReply } from '../components/ChatReply';
import { SlashCustomRender } from '../components/SlashCustomRender';
import { MessageData, createMessageByAI, createMessageByUser } from '../components/utils';
import { WelcomeMessage } from '../components/WelcomeMsg';
import { MsgHistoryManager } from '../model/msg-history-manager';
import { TSlashCommandCustomRender } from '../types';

import { ChatSlashCommandItemModel } from './chat-model';
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

export const AIChatView = observer(() => {
  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const chatApiService = useInjectable<ChatService>(ChatServiceToken);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const msgHistoryManager = useInjectable<MsgHistoryManager>(MsgHistoryManager);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chatInputRef = React.useRef<{ setInputValue: (v: string) => void } | null>(null);

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

  const aiAssistantName = React.useMemo(() => localize('aiNative.chat.ai.assistant.name'), []);

  const shortcutCommands = React.useMemo(() => chatFeatureRegistry.getAllShortcutSlashCommand(), [chatFeatureRegistry]);

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

  const scrollToBottom = React.useCallback(() => {
    if (containerRef && containerRef.current) {
      containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
      // 出现滚动条时出现分割线
      if (containerRef.current.scrollHeight > containerRef.current.clientHeight) {
        containerRef.current.classList.add(SCROLL_CLASSNAME);
      }
    }
  }, [containerRef]);

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
    scrollToBottom();
  }, [loading]);

  React.useEffect(() => {
    const disposer = new Disposable();

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
      chatApiService.onChatReplyMessageLaunch((chunk) => {
        const relationId = aiReporter.start(AISerivceType.CustomReplay, {
          msgType: AISerivceType.CustomReplay,
          message: chunk,
        });

        let renderContent = <ChatMarkdown markdown={chunk} fillInIncompleteTokens />;

        if (chatRenderRegistry.chatAIRoleRender) {
          const ChatAIRoleRender = chatRenderRegistry.chatAIRoleRender;
          renderContent = <ChatAIRoleRender content={chunk} />;
        }

        msgHistoryManager.addAssistantMessage({
          content: chunk,
        });

        const aiMessage = createMessageByAI({
          id: uuid(6),
          relationId,
          text: renderContent,
          className: styles.chat_with_more_actions,
        });

        handleDispatchMessage({ type: 'add', payload: [aiMessage] });
      }),
    );

    return () => disposer.dispose();
  }, [chatApiService, chatRenderRegistry.chatAIRoleRender, msgHistoryManager]);

  React.useEffect(() => {
    const disposer = new Disposable();

    disposer.addDispose(
      chatAgentService.onDidSendMessage((chunk) => {
        const relationId = aiReporter.start(AISerivceType.Agent, {
          msgType: AISerivceType.Agent,
          message: '',
        });

        msgHistoryManager.addAssistantMessage({
          content: chunk.content,
        });

        const notifyMessage = createMessageByAI(
          {
            id: uuid(6),
            relationId,
            text: <ChatNotify requestId={aiChatService.latestRequestId} chunk={chunk} />,
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
    }) => {
      const { userMessage, relationId, requestId, render, startTime } = value;

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
          />
        ),
      });

      handleDispatchMessage({ type: 'add', payload: [aiMessage] });
    },
    [containerRef, msgHistoryManager],
  );

  const handleAgentReply = React.useCallback(
    async (value: IChatMessageStructure) => {
      const { message, agentId, command } = value;

      const request = aiChatService.createRequest(message, agentId!, command);
      if (!request) {
        return;
      }

      setLoading(true);
      aiChatService.setLatestRequestId(request.requestId);

      const ChatUserRoleRender = chatRenderRegistry.chatUserRoleRender;

      const startTime = Date.now();
      const relationId = aiReporter.start(AISerivceType.Agent, {
        msgType: AISerivceType.Agent,
        message: value.message,
      });

      msgHistoryManager.addUserMessage({
        content: message,
        agentId: agentId!,
        agentCommand: command!,
      });

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
            onDidChange={() => {
              scrollToBottom();
            }}
            onDone={() => {
              setLoading(false);
            }}
            onRegenerate={() => {
              aiChatService.sendRequest(request, true);
            }}
          />
        ),
      });

      aiChatService.sendRequest(request);
      handleDispatchMessage({ type: 'add', payload: [aiMessage] });
    },
    [chatRenderRegistry, chatRenderRegistry.chatUserRoleRender, msgHistoryManager, scrollToBottom],
  );

  const handleSend = React.useCallback(async (value: IChatMessageStructure) => {
    const { message, command } = value;

    const agentId = value.agentId ? value.agentId : ChatProxyService.AGENT_ID;
    return handleAgentReply({ message, agentId, command });
  }, []);

  const handleClear = React.useCallback(() => {
    aiChatService.clearSessionModel();
    chatApiService.clearHistoryMessages();
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

  return (
    <div id={styles.ai_chat_view}>
      <div className={styles.header_container}>
        <div className={styles.left}>
          <span className={styles.title}>{aiAssistantName}</span>
        </div>
        <div className={styles.right}>
          <Popover
            overlayClassName={styles.popover_icon}
            id={'ai-chat-header-clear'}
            title={localize('aiNative.operate.clear.title')}
          >
            <EnhanceIcon wrapperClassName={styles.action_btn} className={getIcon('clear')} onClick={handleClear} />
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
            />
          </Popover>
        </div>
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
          <div className={styles.chat_input_wrap}>
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
              <div className={styles.header_operate_right}></div>
            </div>
            <ChatInputWrapperRender
              onSend={(value, agentId, command) => handleSend({ message: value, agentId, command })}
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
});
