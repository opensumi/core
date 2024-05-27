import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { ITextMessageProps, MessageList, SystemMessage } from 'react-chat-elements';

import {
  CODICON_OWNER,
  QUICK_OPEN_COMMANDS,
  getExternalIcon,
  getIcon,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { AI_CHAT_PANEL_TOGGLE_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Button, Icon, Popover, Tooltip } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { CommandOpener } from '@opensumi/ide-core-browser/lib/opener/command-opener';
import { Command, URI, isMacintosh, uuid } from '@opensumi/ide-core-common';
import { CommandService, localize } from '@opensumi/ide-core-common';
import { IAiBackServiceResponse } from '@opensumi/ide-core-common/lib/ai-native';
import { AISerivceType, IAIReporter } from '@opensumi/ide-core-common/lib/ai-native/reporter';

import {
  AiResponseTips,
  IChatAgentService,
  IChatMessageStructure,
  InstructionEnum,
  IChatReplyFollowup,
} from '../common';

import * as styles from './ai-chat.module.less';
import { AiChatService } from './ai-chat.service';
import { AiProjectGenerateService } from './ai-project/generate.service';
import { AiSumiService } from './ai-sumi/sumi.service';
import { ChatFeatureRegistry } from './chat/chat.feature.registry';
import { CodeBlockWrapper, CodeBlockWrapperInput } from './components/ChatEditor';
import { ChatInput } from './components/ChatInput';
import { ChatMarkdown } from './components/ChatMarkdown';
import { ChatMoreActions } from './components/ChatMoreActions';
import { ChatNotify, ChatReply } from './components/ChatReply';
import { Markdown } from './components/Markdown';
import { StreamMsgWrapper } from './components/StreamMsg';
import { Thinking } from './components/Thinking';
import { EMsgStreamStatus, MsgStreamManager } from './model/msg-stream-manager';
// import { AiMenubarService } from './override/layout/menu-bar/menu-bar.service';
import { AiRunService } from './run/run.service';
import { ChatFeatureRegistryToken } from './types';

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
  aiRunService: AiRunService;
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
const extractIcon = (question: IChatReplyFollowup) => {
  let { title } = question;
  const { message, tooltip } = question;

  if (!title) {
    return {
      icon: '',
      title: message,
      message,
      tooltip,
    };
  }

  let icon;

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
};

const AI_NAME = 'AI 研发助手';
const SCROLL_CLASSNAME = 'chat_scroll';
const ME_NAME = '';

const defaultSampleQuestions = [];

const InitMsgComponent = () => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);

  const [sampleQuestions, setSampleQuestions] =
    React.useState<{ icon: string; title: string; message: string; tooltip?: string }[]>(defaultSampleQuestions);

  const welcomeSampleQuestions = React.useMemo(() => {
    if (!chatFeatureRegistry.chatWelcomeMessageModel) {
      return [];
    }

    const { sampleQuestions = [] } = chatFeatureRegistry.chatWelcomeMessageModel;
    return (sampleQuestions as IChatReplyFollowup[]).map(extractIcon);
  }, [chatFeatureRegistry.chatWelcomeMessageModel?.sampleQuestions]);

  const welcomeMessage = React.useMemo(() => {
    const defaultWelcomeMessage = (
      <>
        <div className={styles.chat_container_des}>
          <img src='https://mdn.alipayobjects.com/huamei_htww6h/afts/img/A*66fhSKqpB8EAAAAAAAAAAAAADhl8AQ/original' />
          嗨，我是您的专属 AI 小助手，我在这里回答有关代码的问题，并帮助您思考！
        </div>
        <div className={styles.chat_container_title}>您可以提问我一些关于代码的问题</div>
      </>
    );

    if (!chatFeatureRegistry.chatWelcomeMessageModel) {
      return defaultWelcomeMessage;
    }

    const { content } = chatFeatureRegistry.chatWelcomeMessageModel;

    return content ?? defaultWelcomeMessage;
  }, [chatFeatureRegistry.chatWelcomeMessageModel?.content]);

  React.useEffect(() => {
    const disposer = chatAgentService.onDidChangeAgents(async () => {
      const sampleQuestions = await chatAgentService.getAllSampleQuestions();
      const lists = sampleQuestions.map(extractIcon);

      // 每次全量更新数据，避免扩展卸载的问题
      setSampleQuestions([...defaultSampleQuestions, ...lists]);
    });
    return () => disposer.dispose();
  }, []);

  if (!welcomeMessage) {
    return (
      <Thinking
        status={EMsgStreamStatus.THINKING}
        showStop={false}
        thinkingText={localize('aiNative.chat.welcome.loading.text')}
      />
    );
  }

  return (
    <div className={styles.chat_head}>
      {welcomeMessage}
      <div className={styles.chat_container_content}>
        {welcomeSampleQuestions.concat(sampleQuestions as any).map((data: any, index) => {
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
};

export const AiChatView = observer(() => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const aiProjectGenerateService = useInjectable<AiProjectGenerateService>(AiProjectGenerateService);
  const aiSumiService = useInjectable<AiSumiService>(AiSumiService);
  const aiRunService = useInjectable<AiRunService>(AiRunService);
  // const aiMenubarService = useInjectable<AiMenubarService>(AiMenubarService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const opener = useInjectable<CommandOpener>(CommandOpener);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [messageListData, setMessageListData] = React.useState<MessageData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loading2, setLoading2] = React.useState(false);
  const commandService = useInjectable<CommandService>(CommandService);

  // TODO: theme 基于 command 改造成 command 形式
  const [agentId, setAgentId] = React.useState('');
  const [defaultAgentId, setDefaultAgentId] = React.useState<string>('');
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

  // 项目生成
  const generateProject = React.useCallback(async () => {
    aiProjectGenerateService.start((messageList) => {
      const aiMessageList = messageList
        .map(({ message, immediately, type = 'message', relationId }) =>
          type === 'message'
            ? createMessageByAI({ text: <AiReply text={message} immediately={immediately} />, id: uuid(6), relationId })
            : AICodeReply(message, aiChatService, relationId),
        )
        .filter((m) => !!m) as MessageData[];
      setMessageListData([...aiMessageList]);
    });
  }, []);

  React.useEffect(() => {
    if (aiProjectGenerateService.requirements) {
      generateProject();
    }
  }, [aiProjectGenerateService.requirements]);

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
      text: <CodeBlockWrapperInput text={message} agentId={agentId} relationId={relationId} command={command} />,
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
        text: <CodeBlockWrapperInput text={message} agentId={agentId} relationId={relationId} command={command} />,
        className: styles.chat_message_code,
        role: 'user',
      });

      preMessagelist.push(codeSendMessage);
      setMessageListData(preMessagelist);
      updateState({});

      const replayCommandProps = {
        aiChatService,
        aiReporter,
        aiRunService,
        chatAgentService,
        relationId,
        startTime,
      };

      await handleReply(userInput, replayCommandProps);
    },
    [messageListData, containerRef, loading],
  );

  React.useEffect(() => {
    const disposer = chatAgentService.onDidChangeAgents(async () => {
      const newDefaultAgentId = chatAgentService.getDefaultAgentId();

      setDefaultAgentId(newDefaultAgentId ?? '');
    });
    return () => disposer.dispose();
  }, []);

  const handleReply = React.useCallback(
    async (userInput: { type: AISerivceType; message: string }, replayCommandProps: ReplayComponentParam) => {
      let aiMessage;

      if (userInput.type === AISerivceType.SearchDoc) {
        aiMessage = await AISearch(userInput.message, userInput.type, replayCommandProps);
      } else if (userInput.type === AISerivceType.SearchCode) {
        aiMessage = await AISearch(userInput.message, userInput.type, replayCommandProps);
      } else if (userInput.type === AISerivceType.Sumi) {
        aiMessage = await aiSumiService.searchCommand(userInput.message);
        aiMessage = await AIWithCommandReply(userInput.message, aiMessage, opener, replayCommandProps, async () =>
          handleCommonRetry(userInput, replayCommandProps),
        );
      } else if (
        userInput.type === AISerivceType.GPT ||
        userInput.type === AISerivceType.Explain ||
        userInput.type === AISerivceType.Optimize ||
        userInput.type === AISerivceType.Test
      ) {
        aiMessage = await AIStreamReply(userInput.message, replayCommandProps);
      } else if (userInput.type === AISerivceType.Run) {
        aiMessage = await aiRunService.requestBackService(
          userInput.message,
          aiChatService.cancelIndicatorChatView.token,
        );
        aiMessage = await AIChatRunReply(aiMessage, replayCommandProps);
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

  const handleCommonRetry = React.useCallback(
    async (userInput: { type: AISerivceType; message: string }, replayCommandProps: ReplayComponentParam) => {
      setLoading(true);
      messageListData.pop();
      setMessageListData([...messageListData]);

      const startTime = +new Date();
      await handleReply(userInput, { ...replayCommandProps, startTime, isRetry: true });
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

  const handleClose = React.useCallback(() => {
    commandService.executeCommand(AI_CHAT_PANEL_TOGGLE_VISIBLE.id);
  }, []);

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
          {/* <Popover id={'ai-chat-header-setting'} title='设置'>
            <EnhanceIcon className={getIcon('setting')} onClick={handleUnresolved} />
          </Popover> */}
          <Popover insertClass={styles.popover_icon} id={'ai-chat-header-clear'} title='清空'>
            <EnhanceIcon wrapperClassName={styles.action_btn} className={getIcon('clear')} onClick={handleClear} />
          </Popover>
          <Popover insertClass={styles.popover_icon} id={'ai-chat-header-close'} title='关闭'>
            <EnhanceIcon
              wrapperClassName={styles.action_btn}
              className={getIcon('window-close')}
              onClick={handleClose}
            />
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
              <div className={styles.header_operate_right}>
                {/* <Popover id={'ai-chat-header-message'} title='新对话'>
                  <Icon className={styles.tag} icon={'message'} onClick={handleClear} />
                </Popover>
                <Popover id={'ai-chat-header-history'} title='历史记录'>
                  <Icon className={styles.tag} icon={'time-circle'} onClick={handleUnresolved} />
                </Popover> */}
              </div>
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
        {/* <div className={styles.right_bar}>
          <ul className={styles.chat_list}>
            <li className={styles.active_chat_bar}>
              <Avatar
                src='https://mdn.alipayobjects.com/huamei_htww6h/afts/img/A*CfffRK50dpQAAAAAAAAAAAAADhl8AQ/original'
                className={styles.ai_chat_bar_icon}
              />
            </li>
          </ul>
        </div> */}
      </div>
    </div>
  );
});

// AI 回复组件，就是能一个字一个出现的那种效果
const AiReply = ({ text, endNode = <></>, immediately = false }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [currentText, setCurrentText] = React.useState('');

  React.useEffect(() => {
    if (currentIndex < text.length) {
      if (immediately) {
        setCurrentText(text);
        setCurrentIndex(text.length);
      } else {
        const timeoutId = setTimeout(() => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          setCurrentText(text.slice(0, currentIndex + 1));
          setCurrentIndex(currentIndex + 1);
        }, Math.floor(Math.random() * 41) + 10);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [currentIndex, text]);

  return (
    <div style={{ whiteSpace: 'break-spaces' }}>
      {currentIndex === text.length ? (
        <>
          {currentText}
          {endNode}
        </>
      ) : (
        currentText
      )}
    </div>
  );
};

const AISearch = async (
  input: string,
  type: AISerivceType.SearchDoc | AISerivceType.SearchCode,
  params: ReplayComponentParam,
) => {
  try {
    const { aiChatService, relationId } = params;

    const uid = uuid(6);

    const send = () => {
      aiChatService.setLatestSessionId(relationId);
      if (type === AISerivceType.SearchDoc) {
        aiChatService.searchDoc(input, relationId);
      } else {
        aiChatService.searchCode(input, relationId);
      }
    };

    send();

    const aiMessage = createMessageByAI({
      id: uid,
      relationId,
      text: (
        <StreamMsgWrapper
          sessionId={relationId}
          prompt={input}
          onRegenerate={() => send()}
          renderContent={(content) => (
            <div className={styles.ai_chat_search_container}>
              <div className={styles.ai_response_text}>
                <CodeBlockWrapper
                  text={content}
                  relationId={relationId}
                  renderText={(text) => <ChatMarkdown content={text} />}
                />
              </div>
            </div>
          )}
        ></StreamMsgWrapper>
      ),
      className: styles.chat_with_more_actions,
    });

    return aiMessage;
  } catch (error) {}
};

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
          renderContent={(content) => <Markdown markdown={content} fillInIncompleteTokens relationId={relationId} />}
        ></StreamMsgWrapper>
      ),
      className: styles.chat_with_more_actions,
    });
    return aiMessage;
  } catch (error) {}
};

// 带有代码的 AI 回复组件
const AICodeReply = (input, aiChatService: AiChatService, relationId: string) => {
  try {
    aiChatService.setLatestSessionId(relationId);
    const aiMessage = createMessageByAI({
      id: uuid(6),
      relationId,
      text: (
        <ChatMoreActions sessionId={relationId}>
          <CodeBlockWrapper text={input} relationId={relationId} />
        </ChatMoreActions>
      ),
      className: styles.chat_with_more_actions,
    });
    return aiMessage;
  } catch (error) {}
};

// run 的 AI 回复组件
const AIChatRunReply = async (input, params: ReplayComponentParam) => {
  const { aiRunService, aiReporter, relationId, aiChatService, startTime } = params;
  let aiMessage: AIMessageData | undefined;
  let success = true;
  try {
    const RenderAnswer = aiRunService.answerComponentRender();
    aiChatService.setLatestSessionId(relationId);

    aiMessage = createMessageByAI({
      id: uuid(6),
      relationId,
      text: (
        <ChatMoreActions sessionId={relationId}>
          {RenderAnswer ? (
            <RenderAnswer input={input} relationId={relationId} />
          ) : (
            <CodeBlockWrapper text={input} relationId={relationId} />
          )}
        </ChatMoreActions>
      ),
      className: styles.chat_with_more_actions,
    });
  } catch (error) {
    success = false;
  }

  aiReporter.end(relationId, {
    replytime: +new Date() - startTime,
    success,
    message: input,
  });

  return aiMessage;
};

// 带有命令按钮的 AI 回复
const AIWithCommandReply = async (
  userInput: string,
  commandRes: IAiBackServiceResponse<Command>,
  opener: CommandOpener,
  params: ReplayComponentParam,
  onRetry: () => Promise<void>,
) => {
  const { aiChatService, aiReporter, relationId, startTime, isRetry } = params;

  aiChatService.setLatestSessionId(relationId);

  const failedText = commandRes.errorCode
    ? AiResponseTips.ERROR_RESPONSE
    : !commandRes.data
    ? AiResponseTips.NOTFOUND_COMMAND
    : '';

  aiReporter.end(relationId, {
    replytime: +new Date() - startTime,
    success: !failedText,
    msgType: AISerivceType.Sumi,
    isRetry,
  });

  if (failedText) {
    return createMessageByAI({
      id: uuid(6),
      relationId,
      text: (
        <ChatMoreActions sessionId={relationId} onRetry={onRetry}>
          {failedText === AiResponseTips.NOTFOUND_COMMAND ? (
            <div>
              <p>{failedText}</p>
              <p>{AiResponseTips.NOTFOUND_COMMAND_TIP}</p>
              <Button
                style={{ width: '100%' }}
                onClick={() =>
                  opener.open(
                    URI.from({
                      scheme: 'command',
                      path: QUICK_OPEN_COMMANDS.OPEN_WITH_COMMAND.id,
                      query: JSON.stringify([userInput]),
                    }),
                  )
                }
              >
                打开命令面板
              </Button>
            </div>
          ) : (
            failedText
          )}
        </ChatMoreActions>
      ),
    });
  }

  const { labelLocalized, label, delegate, id } = commandRes.data as Command;

  function excuteCommand() {
    let success = true;
    try {
      opener.open(URI.parse(`command:${delegate || id}`));
    } catch {
      success = false;
    }

    aiReporter.end(relationId, {
      replytime: +new Date() - startTime,
      success: true,
      msgType: AISerivceType.Sumi,
      message: id,
      useCommand: true,
      useCommandSuccess: success,
      isRetry,
    });
  }

  const aiMessage = createMessageByAI({
    id: uuid(6),
    relationId,
    text: (
      <ChatMoreActions sessionId={relationId} onRetry={onRetry}>
        <div className={styles.chat_excute_result}>
          <div>已在系统内找到适合功能: {labelLocalized?.localized || label}，可以按以下步骤尝试：</div>
          <ol className={styles.chat_result_list}>
            <li style={{ listStyle: 'inherit' }}>打开命令面板：({isMacintosh ? 'cmd' : 'ctrl'} + shift + p)</li>
            <li style={{ listStyle: 'inherit' }}>输入：{labelLocalized?.localized || label}</li>
          </ol>
          <Button className={styles.chat_excute_btn} onClick={excuteCommand}>
            点击执行命令
          </Button>
        </div>
      </ChatMoreActions>
    ),
    className: styles.chat_with_more_actions,
  });

  return aiMessage;
};
