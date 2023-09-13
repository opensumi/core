/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as React from 'react';
// @ts-ignore
import { MessageList, SystemMessage, Avatar } from 'react-chat-elements';

import { Markdown } from '@opensumi/ide-components/lib/markdown/index';
import { useInjectable, getIcon, getExternalIcon } from '@opensumi/ide-core-browser';
import { Button, Icon } from '@opensumi/ide-core-browser/lib/components';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';

import 'react-chat-elements/dist/main.css';
import { AiGPTBackSerivcePath, AISerivceType } from '../../common/index';

import * as styles from './ai-chat.module.less';
import { AiChatService } from './ai-chat.service';
import { AiProjectGenerateService } from './ai-project/generate.service';
import { CodeBlockWrapper } from './components/ChatEditor';
import { ChatInput } from './components/ChatInput';
import { Thinking } from './components/Thinking';

const AI_AVATAR = 'https://mdn.alipayobjects.com/huamei_htww6h/afts/img/A*wv3HTok2c58AAAAAAAAAAAAADhl8AQ/original';

const createMessage = (position: string, title: string, text: string | React.ReactNode) => ({
  position,
  type: 'text',
  title,
  text,
  className: position === 'left' ? 'rce-ai-msg' : 'rce-user-msg',
});

const createMessageByAI = (text: string | React.ReactNode) => createMessage('left', '', text);

const AI_NAME = 'AI 研发助手';
const ME_NAME = '';

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, ms);
  });

export const AiChatView = () => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const aiProjectGenerateService = useInjectable<AiProjectGenerateService>(AiProjectGenerateService);
  const aiGPTBackService = useInjectable<any>(AiGPTBackSerivcePath);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [messageListData, setMessageListData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [, updateState] = React.useState<any>();

  const query = window.location.search?.slice(1).split('&');
  let generateQuery;
  if (query.length) {
    generateQuery = query[0].split('=')[1];
  }

  const generateProject = React.useCallback(async (messageList) => {
    await aiProjectGenerateService.clearWorkspace();
    const res = await aiProjectGenerateService.switchProjectLanguage(decodeURIComponent(generateQuery));
    console.log('gen res: ', res);
    if (res) {
      const projectInfo = { framework: res.framework[0], language: res.language, requirements: res.requirements };
      const languageReply = `项目语言为：${projectInfo.language}\n使用框架：${projectInfo.framework}`;
      messageList.unshift(createMessageByAI(<AiReply text={languageReply} immediately={true} />));
      setMessageListData([...messageList]);
      const filePathList = await aiProjectGenerateService.generateProjectStructure(projectInfo);
      console.log('gen file list: ', filePathList);
      messageList.splice(
        -1,
        0,
        createMessageByAI(<AiReply text={`项目结构为:\n${filePathList.join('\n')}`} immediately={true} />),
      );
      setMessageListData([...messageList]);

      await aiProjectGenerateService.generateFile(filePathList, projectInfo, (file: string) => {
        messageList.splice(-1, 0, createMessageByAI(<AiReply text={`正在生成文件:${file}`} />));
        setMessageListData([...messageList]);
      });

      messageList.pop();
      setMessageListData([...messageList]);
    }
  }, []);

  const InitMsgComponent = () => {
    const lists = [
      // { icon: getIcon('plus'), text: '生成 Java 快排算法' },
      // { icon: getIcon('branches'), text: '提交代码' },
      // { icon: getIcon('open-changes'), text: '创建合并请求' },
      // { icon: getIcon('scm'), text: '触发流水线' },
    ];

    if (generateQuery) {
      return (
        <div>
          <span style={{ display: 'block' }}>项目生成中，请稍后....</span>
        </div>
      );
    }

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
                aiChatService.launchChatMessage(data.text);
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

  const firstMsg = React.useMemo(() => createMessageByAI(<InitMsgComponent />), [InitMsgComponent]);

  React.useEffect(() => {
    // @ts-ignore
    window.aiAntGlm = aiGPTBackService.aiAntGlm;

    if (generateQuery) {
      generateProject([firstMsg]);
    } else if (messageListData && messageListData.length === 0) {
      setMessageListData([firstMsg]);
    }

    const dispose = aiChatService.onChatMessageLaunch(async (message) => {
      await handleSend(message);
    });
    // aiChatService.removeOldExtension();
    return () => dispose.dispose();
  }, []);

  const handleSend = React.useCallback(
    async (value?: any) => {
      const preMessagelist = messageListData;
      const preInputValue = value;

      if (containerRef && containerRef.current) {
        containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
      }

      setLoading(true);

      preMessagelist.push(createMessage('right', ME_NAME, preInputValue));
      setMessageListData(preMessagelist);
      // 检查前缀 aiSearchKey
      if (typeof preInputValue === 'string') {
        let aiMessage;

        const userInput = await aiChatService.switchAIService(preInputValue);

        if (userInput!.type === AISerivceType.Search || userInput!.type === AISerivceType.SearchCode) {
          aiMessage = await AISearch(userInput, aiGPTBackService);
        } else if (userInput!.type === AISerivceType.Sumi) {
          aiMessage = await aiChatService.messageWithSumi(userInput!.message!);

          aiMessage = await AIWithCommandReply(aiMessage);
        } else if (userInput!.type === AISerivceType.GPT) {
          aiMessage = await aiChatService.messageWithGPT(userInput!.message!);
          // aiMessage = await AIChatGPTReply(aiMessage, aiGPTBackService);
          aiMessage = await AIChatGPTReply(aiMessage, aiGPTBackService);
        } else if (userInput!.type === AISerivceType.Explain) {
          aiMessage = await aiChatService.messageWithGPT(userInput!.message!);
          aiMessage = await AIChatGPTReply(aiMessage, aiGPTBackService);
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

        return;
      }
    },
    [messageListData, containerRef],
  );

  const viewHeight = React.useMemo(() => `calc(100vh - ${LAYOUT_VIEW_SIZE.MENUBAR_HEIGHT + LAYOUT_VIEW_SIZE.STATUSBAR_HEIGHT}px)`, []);

  return (
    <div id={VIEW_CONTAINERS.RIGHT_TABBAR} className={styles.ai_chat_view} style={{ height: viewHeight }}>
      <div className={styles.header_container}>
        <div className={styles.left}>
          <div className={styles.ai_avatar_icon}>
            <Avatar src={AI_AVATAR} className={styles.ai_chat_avatar_icon} />
          </div>
          <span className={styles.title}>{AI_NAME}</span>
          <span className={styles.line_vertical} />
          <span className={styles.des}>Chat</span>
        </div>
        <div className={styles.right}>
          <Icon className={getIcon('clear')} />
          <Icon className={getIcon('close')} />
        </div>
      </div>
      <div className={styles.body_container}>
        <div className={styles.left_bar}>
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
                  text={<Thinking />}
                ></SystemMessage>
              </div>
            )}
          </div>
          <ChatInput onSend={handleSend} />
        </div>
        <div className={styles.right_bar}>
          <ul className={styles.chat_list}>
            <li className={styles.active_chat_bar}>
              {/* <Icon className={getExternalIcon('comment-discussion')} /> */}
              <Avatar
                src='https://mdn.alipayobjects.com/huamei_htww6h/afts/img/A*CfffRK50dpQAAAAAAAAAAAAADhl8AQ/original'
                className={styles.ai_chat_avatar_icon}
              />
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

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

const AISearch = async (input, aiGPTBackService) => {
  try {
    const result = await aiGPTBackService.aiSearchRequest(
      input.message,
      input.type === AISerivceType.SearchCode ? 'code' : 'overall',
    );

    const { responseText, urlMessage } = result;

    console.log('ai search: >>>> ', result);

    const aiMessage = createMessageByAI(
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div>
          <Markdown value={responseText}></Markdown>
        </div>
        <div style={{ whiteSpace: 'pre-wrap' }}>
          <Markdown value={urlMessage}></Markdown>
        </div>
      </div>,
    );

    return aiMessage;
  } catch (error) {
    console.log('/search: error >>>>>', error);
  }
};

// 带有代码的 AI 回复组件
const AIChatGPTReply = async (input, aiGPTBackService) => {
  try {
    console.log('ai chat gpt reply: >>>> ', input);

    const aiMessage = createMessageByAI(
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <CodeBlockWrapper text={input} />
      </div>,
    );

    return aiMessage;
  } catch (error) {
    console.log('/chat gpt reply: error >>>>>', error);
  }
};

// 带有命令按钮的 AI 回复
const AIWithCommandReply = async (input) => {
  try {
    console.log('ai command reply: >>>> ', input);

    const commandReg = /[Command命令command][:：]\s*(?<command>\S+)\s*/i;
    const command = commandReg.exec(input);
    if (!command) {
      return createMessageByAI(input);
    }

    const aiMessage = createMessageByAI(
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{input}</div>
        <Button>打开命令面板</Button>
      </div>,
    );

    return aiMessage;
  } catch (error) {
    console.log('/ai command reply: error >>>>>', error);
  }
};
