import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { MessageList, SystemMessage, ITextMessageProps } from 'react-chat-elements';

import { DefaultMarkedRenderer, Markdown } from '@opensumi/ide-components/lib/markdown/index';
import { getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Button, Icon, Popover } from '@opensumi/ide-core-browser/lib/components';
import { CommandOpener } from '@opensumi/ide-core-browser/lib/opener/command-opener';
import { Command, isMacintosh, URI, uuid } from '@opensumi/ide-core-common';
import 'react-chat-elements/dist/main.css';

import { AISerivceType, IChatMessageStructure, InstructionEnum, IAIReporter, IAiBackServiceResponse } from '../common';

import * as styles from './ai-chat.module.less';
import { AiChatService } from './ai-chat.service';
import { AiProjectGenerateService } from './ai-project/generate.service';
import { AiSumiService } from './ai-sumi/sumi.service';
import { ERROR_RESPONSE, NOTFOUND_COMMAND } from './common-reponse';
import { CodeBlockWrapper, CodeBlockWrapperInput } from './components/ChatEditor';
import { ChatInput } from './components/ChatInput';
import { ChatMoreActions } from './components/ChatMoreActions';
import { AILogoAvatar, EnhanceIcon } from './components/Icon';
import { LineVertical } from './components/lineVertical';
import { StreamMsgWrapper } from './components/StreamMsg';
import { Thinking } from './components/Thinking';
import { MsgStreamManager, EMsgStreamStatus } from './model/msg-stream-manager';
import { AiMenubarService } from './override/layout/menu-bar/menu-bar.service';
import { AiRunService } from './run/run.service';
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
  relationId: string;
  startTime: number;
}

const createMessage = (message: MessageData) => ({
  ...message,
  type: 'text',
  className: `${message.position === 'left' ? 'rce-ai-msg' : 'rce-user-msg'} ${message.className ? message.className : ''}`,
});

const createMessageByAI = (message: AIMessageData, className?: string) =>
  createMessage({ ...message, position: 'left', title: '', className, role: 'ai' });

const AI_NAME = 'AI 研发助手';
const ME_NAME = '';

export const AiChatView = observer(() => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const aiProjectGenerateService = useInjectable<AiProjectGenerateService>(AiProjectGenerateService);
  const aiSumiService = useInjectable<AiSumiService>(AiSumiService);
  const aiRunService = useInjectable<AiRunService>(AiRunService);
  const aiMenubarService = useInjectable<AiMenubarService>(AiMenubarService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const opener = useInjectable<CommandOpener>(CommandOpener);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [messageListData, setMessageListData] = React.useState<MessageData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [theme, setTheme] = React.useState<string | null>(null);

  const [, updateState] = React.useState<any>();
  // 项目生成
  const generateProject = React.useCallback(async () => {
    aiProjectGenerateService.start((messageList) => {
      const aiMessageList = messageList.map(({ message, immediately, type = 'message', relationId }) =>
        type === 'message'
          ? createMessageByAI({ text: <AiReply text={message} immediately={immediately} />, id: uuid(6), relationId })
          : AICodeReply(message, aiChatService, relationId),
      ).filter((m) => !!m) as MessageData[];
      setMessageListData([...aiMessageList]);
    });
  }, []);

  React.useEffect(() => {
    if (aiProjectGenerateService.requirements) {
      generateProject();
    }
  }, [aiProjectGenerateService.requirements]);

  const InitMsgComponent = () => {
    const lists = [
      { icon: getIcon('send'), text: '生成 Java 快速排序算法', prompt: '生成 Java 快速排序算法' },
      { icon: getIcon('branches'), text: '提交代码', prompt: `${InstructionEnum.aiSumiKey}提交代码` },
    ];

    return (
      <div>
        <span style={{ display: 'block' }}>嗨，我是您的专属 AI 小助手，我在这里回答有关代码的问题，并帮助您思考！</span>
        <br />
        <span style={{ display: 'block' }}>您可以提问我一些关于代码的问题</span>
        <br />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {lists.map((data: any) => (
            <a
              href='javascript:void(0)'
              style={{ marginBottom: '8px' }}
              onClick={() => {
                aiChatService.launchChatMessage({ message: data.prompt });
              }}
            >
              <Icon className={data.icon} style={{ color: 'inherit', marginRight: '4px' }} />
              <span>{data.text}</span>
            </a>
          ))}
        </div>
      </div>
    );
  };

  const firstMsg = React.useMemo(() => createMessageByAI({
    id: uuid(6),
    relationId: '',
    text: <InitMsgComponent />,
  }), [InitMsgComponent]);
  const scrollToBottom = React.useCallback(() => {
    if (containerRef && containerRef.current) {
      containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
    }
  }, [containerRef]);

  React.useEffect(() => {
    setMessageListData([firstMsg]);
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [loading]);

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
      if (loading) {
        return;
      }
      await handleSend(message);
    });
    return () => dispose.dispose();
  }, [messageListData, loading]);

  const handleSend = React.useCallback(
    async (value: IChatMessageStructure) => {
      const { message, prompt } = value;
      const preMessagelist = messageListData;

      setLoading(true);

      let aiMessage;
      const userInput = await aiChatService.switchAIService(message as string, prompt);

      const startTime = +new Date();
      const relationId = aiReporter.start(userInput.type, {
        msgType: userInput.type,
        message: userInput.message,
      });

      const codeSendMessage = createMessage({
        id: uuid(6),
        relationId,
        position: 'right',
        title: ME_NAME,
        text: <CodeBlockWrapperInput text={message} />,
        className:styles.chat_message_code,
        role: 'user',
      });

      preMessagelist.push(codeSendMessage);
      setMessageListData(preMessagelist);
      updateState({});

      const replayCommandProps = {
        aiChatService,
        aiReporter,
        aiRunService,
        relationId,
        startTime,
      };

      if (userInput.type === AISerivceType.Search) {
        aiMessage = await AISearch(userInput, replayCommandProps);
      } else if (userInput.type === AISerivceType.Sumi) {
        aiMessage = await aiSumiService.searchCommand(userInput.message!);
        aiMessage = await AIWithCommandReply(aiMessage, opener, replayCommandProps);
      } else if (userInput.type === AISerivceType.GPT) {
        const withPrompt = aiChatService.opensumiRolePrompt(userInput.message!);
        aiMessage = await AIStreamReply(withPrompt, replayCommandProps);
      } else if (userInput.type === AISerivceType.Explain) {
        aiMessage = await AIStreamReply(userInput.message, replayCommandProps);
      } else if (userInput.type === AISerivceType.Run) {
        aiMessage = await aiRunService.requestBackService(
          userInput.message!,
          aiChatService.cancelIndicatorChatView.token,
        );
        aiMessage = await AIChatRunReply(aiMessage, replayCommandProps);
      }

      if (aiMessage) {
        preMessagelist.push(aiMessage);
        setMessageListData(preMessagelist);
        updateState({});
        if (containerRef && containerRef.current) {
          containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
        }
      }

      setLoading(false);
    },
    [messageListData, containerRef, loading],
  );

  const handleClear = React.useCallback(() => {
    aiChatService.cancelChatViewToken();
    aiChatService.destroyStreamRequest(msgStreamManager.currentSessionId);
    setMessageListData([firstMsg]);
  }, [messageListData]);

  const handleClose = React.useCallback(() => {
    aiMenubarService.toggleRightPanel();
  }, [aiMenubarService]);

  const handleThemeClick = (value) => {
    setTheme(value);
  };

  return (
    <div className={styles.ai_chat_view}>
      <div className={styles.header_container}>
        <div className={styles.left}>
          <div className={styles.ai_avatar_icon}>
            <AILogoAvatar />
          </div>
          <span className={styles.title}>{AI_NAME}</span>
          <LineVertical height='200%' transform='scale(0.5)' />
          <span className={styles.des}>Chat</span>
        </div>
        <div className={styles.right}>
          {/* <Popover id={'ai-chat-header-setting'} title='设置'>
            <EnhanceIcon className={getIcon('setting')} onClick={handleUnresolved} />
          </Popover> */}
          <Popover id={'ai-chat-header-clear'} title='清空'>
            <EnhanceIcon className={getIcon('clear')} onClick={handleClear} />
          </Popover>
          <Popover id={'ai-chat-header-close'} title='关闭'>
            <EnhanceIcon className={getIcon('close')} onClick={handleClose} />
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
                ></SystemMessage>
              </div>
            )}
          </div>
          <div className={styles.chat_input_warp}>
            <div className={styles.header_operate}>
              <div className={styles.header_operate_left}>
                <Popover id={'ai-chat-header-explain'} title='解释代码'>
                  <div className={styles.tag} onClick={() => handleThemeClick(InstructionEnum.aiExplainKey)}>
                    Explain
                  </div>
                </Popover>
                <Popover id={'ai-chat-header-test'} title='添加单测'>
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
              onSend={(value) => handleSend({ message: value })}
              disabled={loading}
              placeholder={'请输入或者粘贴代码'}
              enableOptions={true}
              theme={theme}
              setTheme={setTheme}
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

const codeSearchMarkedRender = new (class extends DefaultMarkedRenderer {
  link(href: string | null, title: string | null, text: string): string {
    return `<a rel="noopener" target="_blank" href="${href}" target="${href}" title="${title ?? href}">${text}</a>`;
  }
})();

const AISearch = async (input, params: ReplayComponentParam) => {
  try {
    const { aiChatService, aiReporter, relationId, startTime } = params;
    const result = await aiChatService.search(input.message, {
      type: input.type,
    });

    const { responseText, urlMessage, isCancel } = result;

    aiReporter.end(relationId, {
      message: `${responseText}\\n${urlMessage}`,
      replytime: +new Date() - startTime,
      success: !result.errorCode,
      isStop: isCancel,
      msgType: AISerivceType.Search,
    });

    if (isCancel) {
      return null;
    }

    const uid = uuid(6);

    const aiMessage = createMessageByAI({
      id: uid,
      relationId,
      text: (
        <ChatMoreActions sessionId={uid}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div>
              <CodeBlockWrapper text={responseText} />
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              <Markdown value={urlMessage} renderer={codeSearchMarkedRender}></Markdown>
              {/* {AICodeReply(urlMessage)} */}
            </div>
          </div>
        </ChatMoreActions>
      ),
      className: styles.chat_with_more_actions,
    });

    aiChatService.setLatestSessionId(uid);
    return aiMessage;
  } catch (error) {}
};

// 流式输出渲染组件
const AIStreamReply = async (prompt: string, params: ReplayComponentParam) => {
  try {
    const { aiChatService, relationId } = params;
    aiChatService.messageWithStream(prompt, {}, relationId);

    const aiMessage = createMessageByAI({
      id: uuid(6),
      relationId,
      text: <StreamMsgWrapper sessionId={relationId} prompt={prompt} />,
      className: styles.chat_with_more_actions,
    });

    aiChatService.setLatestSessionId(relationId);
    return aiMessage;
  } catch (error) {}
};

// 带有代码的 AI 回复组件
const AICodeReply = (input, aiChatService: AiChatService, relationId: string) => {
  try {
    const aiMessage = createMessageByAI({
      id: uuid(6),
      relationId,
      text: (
        <ChatMoreActions sessionId={relationId}>
          <CodeBlockWrapper text={input} />
        </ChatMoreActions>
      ),
      className: styles.chat_with_more_actions,
    });

    aiChatService.setLatestSessionId(relationId);
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

    aiMessage = createMessageByAI({
      id: uuid(6),
      relationId,
      text: (
        <ChatMoreActions sessionId={relationId}>
          {RenderAnswer ? <RenderAnswer input={input} /> : <CodeBlockWrapper text={input} />}
        </ChatMoreActions>
      ),
      className: styles.chat_with_more_actions,
    });

    aiChatService.setLatestSessionId(relationId);
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
const AIWithCommandReply = async (commandRes: IAiBackServiceResponse<Command>, opener: CommandOpener, params: ReplayComponentParam) => {
  const { aiChatService, aiReporter, relationId, startTime } = params;

  const failedText = commandRes.errorCode
                      ? ERROR_RESPONSE
                      : !commandRes.data ? NOTFOUND_COMMAND : '';
  if (failedText) {
    aiReporter.end(relationId, {
      replytime: +new Date() - startTime,
      success: false,
      msgType: AISerivceType.Sumi,
    });
    return createMessageByAI({
      id: uuid(6),
      relationId,
      text: (<ChatMoreActions sessionId={relationId}>{failedText}</ChatMoreActions>),
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
    });
  }

  const aiMessage = createMessageByAI({
    id: uuid(6),
    relationId,
    text: (
      <ChatMoreActions sessionId={relationId}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div>已在系统内找到适合功能: {labelLocalized?.localized || label}，可以按以下步骤尝试：</div>
          <ol style={{ margin: '8px 0' }}>
            <li style={{ listStyle: 'inherit' }}>打开命令面板：({isMacintosh ? 'cmd' : 'ctrl'} + shift + p)</li>
            <li style={{ listStyle: 'inherit' }}>输入：{labelLocalized?.localized || label}</li>
          </ol>
          <Button onClick={excuteCommand}>点击执行命令</Button>
        </div>
      </ChatMoreActions>
    ),
    className: styles.chat_with_more_actions,
  });

  aiChatService.setLatestSessionId(relationId);
  return aiMessage;
};
