import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { MessageList, SystemMessage } from 'react-chat-elements';

import { getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Icon, Popover, Tooltip } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import {
  AISerivceType,
  ChatFeatureRegistryToken,
  ChatRenderRegistryToken,
  IAIReporter,
  localize,
  uuid,
} from '@opensumi/ide-core-common';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { isMarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import 'react-chat-elements/dist/main.css';
import {
  AI_CHAT_VIEW_ID,
  IAIChatService,
  IChatAgentService,
  IChatMessageStructure,
  IChatReplyFollowup,
  ISampleQuestions,
} from '../../common';
import { CodeBlockWrapperInput } from '../components/ChatEditor';
import { ChatInput } from '../components/ChatInput';
import { ChatMarkdown } from '../components/ChatMarkdown';
import { ChatNotify, ChatReply } from '../components/ChatReply';
import { SlashCustomRender } from '../components/SlashCustomRender';
import { IReplayComponentParam, StreamReplyRender } from '../components/StreamReplyRender';
import { ChatThinking } from '../components/Thinking';
import { MessageData, createMessageByAI, createMessageByUser, extractIcon } from '../components/utils';
import { EMsgStreamStatus, MsgStreamManager } from '../model/msg-stream-manager';
import { IChatSlashCommandHandler, TSlashCommandCustomRender } from '../types';

import { ChatSlashCommandItemModel } from './chat-model';
import { ChatFeatureRegistry } from './chat.feature.registry';
import styles from './chat.module.less';
import { ChatRenderRegistry } from './chat.render.registry';
import { ChatService } from './chat.service';


const SCROLL_CLASSNAME = 'chat_scroll';

const InitMsgComponent = () => {
  const aiChatService = useInjectable<ChatService>(IAIChatService);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);

  const [sampleQuestions, setSampleQuestions] = React.useState<ISampleQuestions[]>([]);

  const welcomeSampleQuestions = React.useMemo(() => {
    if (!chatFeatureRegistry.chatWelcomeMessageModel) {
      return [];
    }

    const { sampleQuestions = [] } = chatFeatureRegistry.chatWelcomeMessageModel;
    return (sampleQuestions as IChatReplyFollowup[]).map(extractIcon);
  }, [chatFeatureRegistry.chatWelcomeMessageModel?.sampleQuestions]);

  const welcomeMessage = React.useMemo(() => {
    if (!chatFeatureRegistry.chatWelcomeMessageModel) {
      return '';
    }

    const { content } = chatFeatureRegistry.chatWelcomeMessageModel;
    return content;
  }, [chatFeatureRegistry.chatWelcomeMessageModel?.content]);

  React.useEffect(() => {
    const disposer = chatAgentService.onDidChangeAgents(async () => {
      const sampleQuestions = await chatAgentService.getAllSampleQuestions();
      const lists = sampleQuestions.map(extractIcon);
      setSampleQuestions(lists);
    });
    return () => disposer.dispose();
  }, []);

  if (!welcomeMessage) {
    return (
      <ChatThinking
        status={EMsgStreamStatus.THINKING}
        showStop={false}
        thinkingText={localize('aiNative.chat.welcome.loading.text')}
      />
    );
  }

  const welcomeRender = React.useMemo(() => {
    if (chatRenderRegistry.chatWelcomeRender) {
      return chatRenderRegistry.chatWelcomeRender({ message: welcomeMessage, sampleQuestions: welcomeSampleQuestions });
    }

    return (
      <div className={styles.chat_head}>
        <div className={styles.chat_container_des}>
          {isMarkdownString(welcomeMessage) ? <ChatMarkdown markdown={welcomeMessage} /> : welcomeMessage}
        </div>
        <div className={styles.chat_container_content}>
          {welcomeSampleQuestions.concat(sampleQuestions).map((data: any, index) => {
            const node = (
              <a
                href='javascript:void(0)'
                className={styles.link_item}
                onClick={() => {
                  aiChatService.launchChatMessage(chatAgentService.parseMessage(data.message));
                }}
              >
                {data.icon ? <Icon className={data.icon} style={{ color: 'inherit', marginRight: '4px' }} /> : ''}
                <span>{data.title}</span>
              </a>
            );
            return data.tooltip ? (
              <Tooltip title={data.tooltip} key={index}>
                {node}
              </Tooltip>
            ) : (
              <React.Fragment key={index}>{node}</React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }, [chatRenderRegistry.chatWelcomeRender, welcomeMessage, welcomeSampleQuestions]);

  return welcomeRender as React.JSX.Element;
};

export const AIChatView = observer(() => {
  const aiChatService = useInjectable<ChatService>(IAIChatService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);
  const monacoCommandRegistry = useInjectable<MonacoCommandRegistry>(MonacoCommandRegistry);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const chatInputRef = React.useRef<{ setInputValue: (v: string) => void } | null>(null);

  const [messageListData, dispatchMessage] = React.useReducer(
    (state: MessageData[], action: { type: 'add' | 'clear' | 'init'; payload?: MessageData[] }) => {
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
    },
    [],
  );
  const [loading, setLoading] = React.useState(false);
  const [loading2, setLoading2] = React.useState(false);

  const [agentId, setAgentId] = React.useState('');
  const [defaultAgentId, setDefaultAgentId] = React.useState<string>('');
  const [command, setCommand] = React.useState('');
  const [theme, setTheme] = React.useState<string | null>(null);

  const aiAssistantName = React.useMemo(() => localize('aiNative.chat.ai.assistant.name'), []);

  const shortcutCommands = React.useMemo(() => chatFeatureRegistry.getAllShortcutSlashCommand(), [chatFeatureRegistry]);

  React.useEffect(() => {
    msgStreamManager.onMsgStatus((event) => {
      if (event === EMsgStreamStatus.DONE || event === EMsgStreamStatus.ERROR) {
        setLoading2(false);
      } else if (event === EMsgStreamStatus.THINKING) {
        setLoading2(true);
      }
    });
    return () => {
      msgStreamManager.dispose();
    };
  }, []);

  const firstMsg = React.useMemo(
    () =>
      createMessageByAI({
        id: uuid(6),
        relationId: '',
        text: <InitMsgComponent />,
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

  React.useEffect(() => {
    dispatchMessage({ type: 'init', payload: [firstMsg] });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [loading, loading2]);

  React.useEffect(() => {
    const dispose = msgStreamManager.onMsgStatus(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    });
    return () => dispose.dispose();
  }, [msgStreamManager.onMsgStatus]);

  React.useEffect(() => {
    const dispose = aiChatService.onChatMessageLaunch(async (message) => {
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
    });
    return () => dispose.dispose();
  }, [messageListData, loading]);

  React.useEffect(() => {
    const disposer = chatAgentService.onDidSendMessage((chunk) => {
      const relationId = aiReporter.start(AISerivceType.Agent, {
        msgType: AISerivceType.Agent,
        message: '',
      });

      const notifyMessage = createMessageByAI(
        {
          id: uuid(6),
          relationId,
          text: <ChatNotify relationId={relationId} chunk={chunk} />,
        },
        styles.chat_notify,
      );
      dispatchMessage({ type: 'add', payload: [notifyMessage] });
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    });
    return () => disposer.dispose();
  }, []);

  React.useEffect(() => {
    const disposer = chatAgentService.onDidChangeAgents(async () => {
      const newDefaultAgentId = chatAgentService.getDefaultAgentId();

      setDefaultAgentId(newDefaultAgentId ?? '');
    });
    return () => disposer.dispose();
  }, []);

  const handleSlashCustomRender = React.useCallback(
    async (value: {
      message: string;
      slashCommand: ChatSlashCommandItemModel;
      render: TSlashCommandCustomRender;
      relationId: string;
      startTime: number;
    }) => {
      const { message, slashCommand, relationId, render, startTime } = value;

      const aiMessage = createMessageByAI({
        id: uuid(6),
        relationId,
        className: styles.chat_with_more_actions,
        text: (
          <SlashCustomRender message={message} startTime={startTime} relationId={relationId} renderContent={render} />
        ),
      });

      dispatchMessage({ type: 'add', payload: [aiMessage] });

      if (containerRef && containerRef.current) {
        containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
      }
    },
    [containerRef],
  );

  const handleAgentReply = React.useCallback(
    async (value: IChatMessageStructure) => {
      const { message, agentId, command } = value;
      const chatUserRoleRender = chatRenderRegistry.chatUserRoleRender;

      const request = aiChatService.createRequest(message, agentId!, command);
      if (!request) {
        return;
      }

      const startTime = Date.now();
      const relationId = aiReporter.start(AISerivceType.Agent, {
        msgType: AISerivceType.Agent,
        message: value.message,
      });

      const userMessage = createMessageByUser(
        {
          id: uuid(6),
          relationId,
          text: chatUserRoleRender ? (
            chatUserRoleRender({ content: message, agentId, command })
          ) : (
            <CodeBlockWrapperInput relationId={relationId} text={message} agentId={agentId} command={command} />
          ),
        },
        styles.chat_message_code,
      );

      const aiMessage = createMessageByAI({
        id: uuid(6),
        relationId,
        className: styles.chat_with_more_actions,
        text: (
          <ChatReply
            relationId={relationId}
            request={request}
            startTime={startTime}
            onRegenerate={() => {
              msgStreamManager.sendThinkingStatue();
              aiChatService.sendRequest(request, true);
            }}
          />
        ),
      });

      msgStreamManager.setCurrentSessionId(relationId);
      msgStreamManager.sendThinkingStatue();
      aiChatService.setLatestSessionId(relationId);
      aiChatService.sendRequest(request);

      dispatchMessage({ type: 'add', payload: [userMessage, aiMessage] });

      if (containerRef && containerRef.current) {
        containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
      }
    },
    [chatRenderRegistry, chatRenderRegistry.chatUserRoleRender],
  );

  const handleSend = React.useCallback(
    async (value: IChatMessageStructure) => {
      const { message, prompt, reportType, agentId, command } = value;
      const chatUserRoleRender = chatRenderRegistry.chatUserRoleRender;

      if (agentId) {
        return handleAgentReply({ message, agentId, command });
      }

      const userInput = {
        type: AISerivceType.Chat,
        message: prompt || message,
      };

      const { nameWithSlash } = chatFeatureRegistry.parseSlashCommand(message);
      let commandHandler: IChatSlashCommandHandler | undefined;

      if (nameWithSlash) {
        commandHandler = chatFeatureRegistry.getSlashCommandHandlerBySlashName(nameWithSlash);
      }

      if (commandHandler && commandHandler.providerPrompt) {
        const editor = monacoCommandRegistry.getActiveCodeEditor();
        const slashCommandPrompt = await commandHandler.providerPrompt(message, editor);
        userInput.message = slashCommandPrompt;
      }

      const startTime = +new Date();
      const relationId = aiReporter.start(reportType || userInput.type, {
        msgType: reportType || userInput.type,
        message: userInput.message,
      });

      const sendMessage = createMessageByUser(
        {
          id: uuid(6),
          relationId,
          text: chatUserRoleRender ? (
            chatUserRoleRender({ content: message, agentId: agentId ?? '', command: command ?? '' })
          ) : (
            <CodeBlockWrapperInput relationId={relationId} text={message} agentId={agentId} command={command} />
          ),
        },
        styles.chat_message_code,
      );

      dispatchMessage({ type: 'add', payload: [sendMessage] });

      if (commandHandler && commandHandler.providerRender) {
        const command = chatFeatureRegistry.getSlashCommandBySlashName(nameWithSlash);

        return handleSlashCustomRender({
          message,
          slashCommand: command!,
          render: commandHandler.providerRender,
          relationId,
          startTime,
        });
      }

      setLoading(true);

      handleReply(userInput, {
        aiChatService,
        aiReporter,
        chatAgentService,
        relationId,
        startTime,
        rawMessage: message,
      });
    },
    [
      messageListData,
      containerRef,
      loading,
      chatFeatureRegistry,
      chatRenderRegistry,
      chatRenderRegistry.chatUserRoleRender,
    ],
  );

  const handleReply = React.useCallback(
    (userInput: { type: AISerivceType; message: string }, replayCommandProps: IReplayComponentParam) => {
      if (chatRenderRegistry.chatAIRoleRender) {
        replayCommandProps.renderContent = (content: string, status: EMsgStreamStatus) =>
          chatRenderRegistry.chatAIRoleRender!({ content, status });
      }

      const aiMessage = StreamReplyRender(userInput.message, replayCommandProps);

      if (aiMessage) {
        dispatchMessage({ type: 'add', payload: [aiMessage] });
        if (containerRef && containerRef.current) {
          containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
        }
      }
      setLoading(false);
    },
    [messageListData, chatRenderRegistry, chatRenderRegistry.chatAIRoleRender],
  );

  const handleClear = React.useCallback(() => {
    aiChatService.cancelChatViewToken();
    aiChatService.destroyStreamRequest(msgStreamManager.currentSessionId);
    aiChatService.clearSessionModel();
    containerRef?.current?.classList.remove(SCROLL_CLASSNAME);
    dispatchMessage({ type: 'init', payload: [firstMsg] });
  }, [messageListData]);

  const handleThemeClick = (value) => {
    if (loading || loading2) {
      return;
    }
    setTheme(value);
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
            insertClass={styles.popover_icon}
            id={'ai-chat-header-clear'}
            title={localize('aiNative.operate.clear.title')}
          >
            <EnhanceIcon wrapperClassName={styles.action_btn} className={getIcon('clear')} onClick={handleClear} />
          </Popover>
          <Popover
            insertClass={styles.popover_icon}
            id={'ai-chat-header-close'}
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
            {loading && (
              <div className={styles.chat_loading_msg_box}>
                <SystemMessage
                  title={aiAssistantName}
                  className={styles.smsg}
                  // @ts-ignore
                  text={<ChatThinking status={EMsgStreamStatus.THINKING} />}
                />
              </div>
            )}
          </div>
          <div className={styles.chat_input_wrap}>
            <div className={styles.header_operate}>
              <div className={styles.header_operate_left}>
                {shortcutCommands.map((command) => (
                  <Popover id={`ai-chat-shortcut-${command.name}`} title={command.tooltip || command.name}>
                    <div className={styles.tag} onClick={() => handleThemeClick(command.nameWithSlash)}>
                      {command.name}
                    </div>
                  </Popover>
                ))}
              </div>
              <div className={styles.header_operate_right}></div>
            </div>
            <ChatInput
              onSend={(value, agentId, command) => handleSend({ message: value, agentId, command })}
              disabled={loading || loading2}
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
