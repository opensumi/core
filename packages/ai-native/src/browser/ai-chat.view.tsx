import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { ITextMessageProps, MessageList, SystemMessage } from 'react-chat-elements';

import { CODICON_OWNER, IAIReporter, getExternalIcon, getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Icon, Popover, Tooltip } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { uuid } from '@opensumi/ide-core-common';

import { AISerivceType, IChatAgentService, IChatMessageStructure, InstructionEnum } from '../common';

import styles from './ai-chat.module.less';
import { AiChatService } from './ai-chat.service';
import { CodeBlockWrapperInput } from './components/ChatEditor';
import { ChatInput } from './components/ChatInput';
import { ChatNotify, ChatReply } from './components/ChatReply';
import { Markdown } from './components/Markdown';
import { StreamMsgWrapper } from './components/StreamMsg';
import { Thinking } from './components/Thinking';
import { EMsgStreamStatus, MsgStreamManager } from './model/msg-stream-manager';

import 'react-chat-elements/dist/main.css';

interface MessageData extends Pick<ITextMessageProps, 'id' | 'position' | 'className' | 'title'> {
  role: 'user' | 'ai';
  relationId: string;
  className?: string;
  text: string | React.ReactNode;
}

type AIMessageData = Omit<MessageData, 'role' | 'position' | 'title'>;

interface ReplayComponentParam {
  aiChatService: AiChatService;
  aiReporter: IAIReporter;
  chatAgentService: IChatAgentService;
  relationId: string;
  startTime: number;
  isRetry?: boolean;
}

const createMessage = (message: MessageData) => ({
  ...message,
  type: 'text',
  className: `${message.position === 'left' ? 'rce-ai-msg' : 'rce-user-msg'} ${
    message.className ? message.className : ''
  }`,
});

const createMessageByAI = (message: AIMessageData, className?: string) =>
  createMessage({ ...message, position: 'left', title: '', className, role: 'ai' });

const AI_NAME = 'AI 研发助手';
const SCROLL_CLASSNAME = 'chat_scroll';
const ME_NAME = '';

const defaultSampleQuestions = [
  {
    icon: getIcon('send-hollow'),
    title: '生成 Java 快速排序算法',
    message: '生成 Java 快速排序算法',
  },
];

const InitMsgComponent = () => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);

  const [sampleQuestions, setSampleQuestions] =
    React.useState<{ icon: string; title: string; message: string; tooltip?: string }[]>(defaultSampleQuestions);

  React.useEffect(() => {
    const disposer = chatAgentService.onDidChangeAgents(async () => {
      const sampleQuestions = await chatAgentService.getAllSampleQuestions();
      const lists = sampleQuestions.map((item) => {
        let { title, message, tooltip } = item;
        if (!title) {
          return {
            icon: '',
            title: message,
            message,
            tooltip,
          };
        }
        let icon = '';
        const iconMatched = title.match(/^\$\(([a-z.]+\/)?([a-z0-9-]+)(~[a-z]+)?\)/i);
        if (iconMatched) {
          const [matchedStr, owner, name, modifier] = iconMatched;
          const iconOwner = owner ? owner.slice(0, -1) : CODICON_OWNER;
          icon = getExternalIcon(name, iconOwner);
          if (modifier) {
            icon += ` ${modifier.slice(1)}`;
          }
          title = title.slice(matchedStr.length);
        }
        return {
          icon,
          title,
          message,
          tooltip,
        };
      });
      // 每次全量更新数据，避免扩展卸载的问题
      setSampleQuestions([...defaultSampleQuestions, ...lists]);
    });
    return () => disposer.dispose();
  }, []);

  return (
    <div className={styles.chat_head}>
      <span className={styles.chat_container_des}>
        <img src='https://mdn.alipayobjects.com/huamei_htww6h/afts/img/A*66fhSKqpB8EAAAAAAAAAAAAADhl8AQ/original' />
        嗨，我是您的专属 AI 小助手，我在这里回答有关代码的问题，并帮助您思考！
      </span>
      <span className={styles.chat_container_title}>您可以提问我一些关于代码的问题</span>
      <div className={styles.chat_container_content} style={{ display: 'flex', flexDirection: 'column' }}>
        {sampleQuestions.map((data: any, index) => {
          const node = (
            <a
              href='javascript:void(0)'
              style={{ marginBottom: '4px' }}
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
};

export const AiChatView = observer(() => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [messageListData, setMessageListData] = React.useState<MessageData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loading2, setLoading2] = React.useState(false);

  // TODO: theme 基于 command 改造成 command 形式
  const [agentId, setAgentId] = React.useState('');
  const [command, setCommand] = React.useState('');
  const [theme, setTheme] = React.useState<string | null>(null);

  const [state, updateState] = React.useState<any>();

  const chatInputRef = React.useRef<{ setInputValue: (v: string) => void } | null>(null);

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
    setMessageListData([firstMsg]);
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [loading, loading2, state]);

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
      setMessageListData((msgList) => [...msgList, notifyMessage]);
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    });
    return () => disposer.dispose();
  }, []);

  const handleAgentReply = React.useCallback(async (value: IChatMessageStructure) => {
    const { message, agentId, command } = value;

    const request = aiChatService.createRequest(message, agentId!, command);
    if (!request) {
      return;
    }

    const startTime = Date.now();
    const relationId = aiReporter.start(AISerivceType.Agent, {
      msgType: AISerivceType.Agent,
      message: value.message,
    });

    const userMessage = createMessage({
      id: uuid(6),
      relationId,
      position: 'right',
      title: ME_NAME,
      text: <CodeBlockWrapperInput relationId={relationId} text={message} agentId={agentId} command={command} />,
      className: styles.chat_message_code,
      role: 'user',
    });

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

    setMessageListData((msgList) => [...msgList, userMessage, aiMessage]);

    if (containerRef && containerRef.current) {
      containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
    }
  }, []);

  const handleSend = React.useCallback(
    async (value: IChatMessageStructure) => {
      const { message, prompt, reportType, agentId, command } = value;
      const preMessagelist = messageListData;

      if (agentId) {
        return handleAgentReply({ message, agentId, command });
      }

      setLoading(true);

      const userInput = await aiChatService.switchAIService(message as string, prompt);

      const startTime = +new Date();
      const relationId = aiReporter.start(reportType || userInput.type, {
        msgType: reportType || userInput.type,
        message: userInput.message,
      });

      const codeSendMessage = createMessage({
        id: uuid(6),
        relationId,
        position: 'right',
        title: ME_NAME,
        text: <CodeBlockWrapperInput relationId={relationId} text={message} agentId={agentId} command={command} />,
        className: styles.chat_message_code,
        role: 'user',
      });

      preMessagelist.push(codeSendMessage);
      setMessageListData(preMessagelist);
      updateState({});

      const replayCommandProps = {
        aiChatService,
        aiReporter,
        chatAgentService,
        relationId,
        startTime,
      };

      await handleReply(userInput, replayCommandProps);
    },
    [messageListData, containerRef, loading],
  );

  const handleReply = React.useCallback(
    async (userInput: { type: AISerivceType; message: string }, replayCommandProps: ReplayComponentParam) => {
      let aiMessage;

      if (
        userInput.type === AISerivceType.GPT ||
        userInput.type === AISerivceType.Explain ||
        userInput.type === AISerivceType.Optimize ||
        userInput.type === AISerivceType.Test
      ) {
        aiMessage = await AIStreamReply(userInput.message, replayCommandProps);
      }

      if (aiMessage) {
        messageListData.push(aiMessage);
        setMessageListData([...messageListData]);
        updateState({});
        if (containerRef && containerRef.current) {
          containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
        }
      }
      setLoading(false);
    },
    [messageListData],
  );

  const handleClear = React.useCallback(() => {
    aiChatService.cancelChatViewToken();
    aiChatService.destroyStreamRequest(msgStreamManager.currentSessionId);
    aiChatService.clearSessionModel();
    // 清除滚动条出现时的分割线
    containerRef?.current?.classList.remove(SCROLL_CLASSNAME);
    setMessageListData([firstMsg]);
  }, [messageListData]);

  const handleThemeClick = (value) => {
    if (loading || loading2) {
      return;
    }
    setTheme(value);
  };

  return (
    <div className={styles.ai_chat_view}>
      <div className={styles.header_container}>
        <div className={styles.left}>
          <span className={styles.title}>{AI_NAME}</span>
        </div>
        <div className={styles.right}>
          <Popover insertClass={styles.popover_icon} id={'ai-chat-header-clear'} title='清空'>
            <EnhanceIcon wrapperClassName={styles.action_btn} className={getIcon('clear')} onClick={handleClear} />
          </Popover>
          <Popover insertClass={styles.popover_icon} id={'ai-chat-header-close'} title='关闭'>
            <EnhanceIcon wrapperClassName={styles.action_btn} className={getIcon('window-close')} />
          </Popover>
        </div>
      </div>
      <div className={styles.body_container}>
        <div className={styles.left_bar} id='ai_chat_left_container'>
          <div className={styles.chat_container} ref={containerRef}>
            {/* @ts-ignore */}
            <MessageList
              className={styles.message_list}
              lockable={true}
              toBottomHeight={'100%'}
              // @ts-ignore
              dataSource={messageListData}
            />
            {loading && (
              <div className={styles.chat_loading_msg_box}>
                {/* @ts-ignore */}
                <SystemMessage
                  title={AI_NAME}
                  className={styles.smsg}
                  // @ts-ignore
                  text={<Thinking status={EMsgStreamStatus.THINKING} />}
                />
              </div>
            )}
          </div>
          <div className={styles.chat_input_wrap}>
            <div className={styles.header_operate}>
              <div className={styles.header_operate_left}>
                <Popover id={'ai-chat-header-explain'} title='解释代码'>
                  <div className={styles.tag} onClick={() => handleThemeClick(InstructionEnum.aiExplainKey)}>
                    Explain
                  </div>
                </Popover>
                <Popover id={'ai-chat-header-test'} title='生成单测'>
                  <div className={styles.tag} onClick={() => handleThemeClick(InstructionEnum.aiTestKey)}>
                    Test
                  </div>
                </Popover>
                <Popover id={'ai-chat-header-optimize'} title='优化代码'>
                  <div className={styles.tag} onClick={() => handleThemeClick(InstructionEnum.aiOptimzeKey)}>
                    Optimize
                  </div>
                </Popover>
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

// 流式输出渲染组件
const AIStreamReply = async (prompt: string, params: ReplayComponentParam) => {
  try {
    const { aiChatService, relationId } = params;
    const send = () => {
      aiChatService.setLatestSessionId(relationId);
      aiChatService.messageWithStream(prompt, {}, relationId);
    };

    send();

    const aiMessage = createMessageByAI({
      id: uuid(6),
      relationId,
      text: (
        <StreamMsgWrapper
          sessionId={relationId}
          prompt={prompt}
          onRegenerate={() => send()}
          renderContent={(content) => <Markdown markdown={content} fillInIncompleteTokens />}
        ></StreamMsgWrapper>
      ),
      className: styles.chat_with_more_actions,
    });
    return aiMessage;
  } catch (error) {}
};
