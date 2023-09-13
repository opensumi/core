/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import hljs from 'highlight.js';
import * as React from 'react';
// @ts-ignore
import { MessageList, SystemMessage, Avatar } from 'react-chat-elements';
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

import { Markdown } from '@opensumi/ide-components/lib/markdown/index';
import { PreferenceService, useInjectable, getIcon, getExternalIcon } from '@opensumi/ide-core-browser';
import { Button, Icon, Input } from '@opensumi/ide-core-browser/lib/components';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import 'react-chat-elements/dist/main.css';
import { CommandService } from '@opensumi/ide-core-common';
import { AiGPTBackSerivcePath, AISerivceType } from '../../common/index';

import * as styles from './ai-chat.module.less';
import { AiChatService } from './ai-chat.service';
import { CodeBlockWrapper } from './components/ChatEditor';

const AI_AVATAR =
  'https://done.alibaba-inc.com/preview/proxy/2023/08/16/4866db7a5f59bba4/preview/assets/BB6B2997-584C-4537-ACE5-27E0D671ECD2/84F80576-6A6E-44BA-8892-03DBDDE3798D.svg';

const createMessage = (position: string, title: string, text: string | React.ReactNode) => ({
  position,
  type: 'text',
  title,
  text,
  className: position === 'left' ? 'rce-ai-msg' : 'rce-user-msg',
});

const createMessageByAI = (text: string | React.ReactNode) => ({
    ...createMessage('left', '', text),
    avatar: AI_AVATAR,
  });

// const createMessageByMe = (text: string | React.ReactNode) => createMessage('right', ME_NAME, text);

const AI_NAME = 'AI 助手';
const ME_NAME = '';

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, ms);
  });

export const AiChatView = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const aiGPTBackService = useInjectable<any>(AiGPTBackSerivcePath);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [inputValue, setInputValue] = React.useState('');
  const [messageListData, setMessageListData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [, updateState] = React.useState<any>();
  // const forceUpdate = React.useCallback(() => updateState({}), []);

  const query = window.location.search?.slice(1).split('&');
  let generateQuery;
  if (query.length) {
    generateQuery = query[0].split('=')[1];
  }

  const generateProject = React.useCallback(async (messageList) => {
    const res = await aiChatService.switchProjectLanguage(decodeURIComponent(generateQuery));
    console.log('gen res: ', res);
    if (res) {
      const { language, framework, requirements } = res;
      const languageReply = `项目语言为：${language}\n使用框架：${framework[0]}`;
      messageList.unshift(createMessageByAI(<AiReply text={languageReply} immediately={true} />));
      setMessageListData([...messageList]);

      const filePathList = await aiChatService.generateProjectStructure(language, framework[0], requirements);
      console.log('gen file list: ', filePathList);
      messageList.splice(-1, 0, createMessageByAI(<AiReply text={`项目结构为:\n${filePathList.join('\n')}`} immediately={true} />));
      setMessageListData([...messageList]);

      await Promise.all(filePathList.map(async (file) => {
        await aiChatService.generateFileContent(file, requirements);
        messageList.splice(-1, 0, createMessageByAI(<AiReply text={`正在生成文件:${file}`} />));
        setMessageListData([...messageList]);
      }));

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
    return () => dispose.dispose();;
  }, []);

  const handleInputChange = React.useCallback((value) => {
    setInputValue(value);
  }, []);

  const switchTask = React.useMemo(
    () => [],
    [],
  );

  const handleSend = React.useCallback(
    async (value?: any) => {
      const preMessagelist = messageListData;
      const preInputValue = value || inputValue;

      if (containerRef && containerRef.current) {
        containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
      }

      setLoading(true);
      setInputValue('');

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
          aiMessage = createMessageByAI(aiMessage);
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

      await sleep(1000);

      setLoading(false);

      for await (const { with: _with, exec } of switchTask) {
        const v = typeof preInputValue === 'string' ? preInputValue : preInputValue.props.children[0];

        if (v.includes(_with)) {
          const msg = await exec(preInputValue);
          preMessagelist.push(msg);
          setMessageListData(preMessagelist);
          updateState({});
          if (containerRef && containerRef.current) {
            containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
          }
          return;
        }
      }
    },
    [messageListData, inputValue, containerRef],
  );

  React.useEffect(() => {
    document.querySelectorAll('pre code').forEach((block) => {
      // @ts-ignore
      try {
        // @ts-ignore
        hljs.highlightBlock(block);
      } catch (e) {
        console.log(e);
      }
    });
  }, []);

  return (
    <div id={VIEW_CONTAINERS.RIGHT_TABBAR} className={styles.ai_chat_view}>
      <div className={styles.header_container}>
        <div className={styles.left}>
          <span className={styles.title}>AI 研发助手</span>
          <span className={styles.line_vertical}> | </span>
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
                <Avatar src={AI_AVATAR} className={styles.chat_loading_mgs_avatar} />
                {/* @ts-ignore */}
                <SystemMessage
                  title={AI_NAME}
                  className={styles.smsg}
                  // @ts-ignore
                  text={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span>Thinking...</span>
                    </div>
                  }
                ></SystemMessage>
              </div>
            )}
          </div>
          {/* <div className={styles.quick_way}>
            <span className={`${styles.quick_way_item} ${getExternalIcon('color-mode')}`} onClick={() => handleSend('/sumi 设置主题')}></span>
            <span className={`${styles.quick_way_item} ${getIcon('info-circle')}`} onClick={() => handleSend('/sumi 提示用户 hello world')}></span>
          </div> */}
          <div className={styles.chat_input}>
            <Input
              placeholder={'可以问我任何问题，或键入主题 "/"'}
              value={inputValue}
              onValueChange={handleInputChange}
              className={styles.input_wrapper}
              onPressEnter={() => handleSend()}
              addonAfter={
                <div className={styles.send_chat_btn} onClick={() => handleSend()}>
                  <Icon className={getIcon('right')} />
                </div>
              }
            />
            {/* <Button onClick={() => handleSend()}>Send</Button> */}
          </div>
        </div>
        <div className={styles.right_bar}>
          <ul className={styles.chat_list}>
            <li className={styles.active_chat_bar}>
              <Icon className={getExternalIcon('comment-discussion')} />
            </li>
            <li>
              <Icon className={getExternalIcon('comment-discussion')} />
            </li>
            <li>
              <Icon className={getExternalIcon('comment-discussion')} />
            </li>
            <li>
              <Icon className={getIcon('plus')} />
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
        {/* <div><Markdown content={responseText} options={{ headerIds: false }}></Markdown></div> */}
        <div>
          <Markdown value={responseText}></Markdown>
        </div>
        {/* <SyntaxHighlighter>{responseText}</SyntaxHighlighter> */}
        {/* <div>{urlMessage}</div> */}
        {/* <div><Markdown content={urlMessage} options={{ headerIds: false, gfm: true }}></Markdown></div> */}
        <div style={{ whiteSpace: 'pre-wrap' }}>
          <Markdown value={urlMessage}></Markdown>
        </div>
        {/* <SyntaxHighlighter>{urlMessage}</SyntaxHighlighter> */}
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
        <CodeBlockWrapper text={input}/>
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