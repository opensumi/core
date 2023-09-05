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
import { Icon, Input } from '@opensumi/ide-core-browser/lib/components';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import 'react-chat-elements/dist/main.css';
import { CommandService } from '@opensumi/ide-core-common';
import { AiGPTBackSerivcePath, AISerivceType } from '@opensumi/ide-startup/lib/common/index';

import * as styles from './ai-chat.module.less';
import { AiChatService } from './ai-chat.service';

// import { Markdown } from '@opensumi/ide-markdown';

const AI_AVATAR =
  'https://done.cdn.alibabadesign.com/2023/08/16/4866db7a5f59bba4/preview/assets/6D541F03-3063-4F43-9FCC-27CD9830AEC8/F3E22F76-4171-4263-BEAD-F28A5C0C0429.svg?sign=68948ee76126c039cd6befef7e79fd47&timestamp=1693670399999';

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
        await aiChatService.generateFileContent(file, requirements, 1);
        messageList.splice(-1, 0, createMessageByAI(<AiReply text={`正在生成文件:${file}`} />));
        setMessageListData([...messageList]);
      }));

      messageList.pop();
      setMessageListData([...messageList]);
    }
  }, []);

  const InitMsgComponent = () => {
    const lists = [
      { icon: getIcon('plus'), text: '生成 Java 快排算法' },
      { icon: getIcon('branches'), text: '提交代码' },
      { icon: getIcon('open-changes'), text: '创建合并请求' },
      { icon: getIcon('scm'), text: '触发流水线' },
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
        <span style={{ display: 'block' }}>您可以提问我一些关于代码的问题，例如：</span>
        <br />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {lists.map((data) => (
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
    () => [
      {
        with: '新建',
        exec: async (s) => {
          // 字符串提取双引号内的文本
          const fileName = s.match(/"([^"]*)"/)[1];

          const error = await commandService.executeCommand('ai.chat.createNewFile', fileName);
          if (error) {
            return createMessageByAI(<AiReply text={'文件已存在，无法重复创建噢'} />);
          }
          return createMessageByAI(<AiReply text={'文件已经新建好啦～'} />);
        },
      },
      {
        with: 'http 服务',
        exec: async (s) => {
          // 字符串提取数字
          const num = s.replace(/[^0-9]/gi, '');
          await commandService.executeCommand('ai.chat.createNodeHttpServerContent', num);

          return createMessageByAI(
            <div>
              <AiReply
                text={'已为你创建了一个 node http 服务的代码示例，端口号为 8888，可点击'}
                endNode={
                  <>
                    {' '}
                    <a
                      href='javascript:void(0)'
                      onClick={() => {
                        commandService.executeCommand('ai.runAndDebug');
                      }}
                    >
                      {' '}
                      run
                    </a>{' '}
                    运行～
                  </>
                }
              />
            </div>,
          );
        },
      },
      {
        with: '聚焦到',
        exec: async (value: string) => {
          // 字符串提取数字
          const num = value.replace(/[^0-9]/gi, '');
          await commandService.executeCommand('ai.chat.focusLine', num);
          return createMessageByAI('已为您聚焦到第 ' + num + ' 行');
        },
      },
      {
        with: 'lazyman',
        exec: async () => {
          await commandService.executeCommand('ai.chat.createNewFile', 'lazyman.ts');

          await sleep(2000);

          await commandService.executeCommand('ai.chat.createLazymanContent');

          return createMessageByAI(
            <div>
              <AiReply
                text={
                  '已为你设计好了 lazyman 的实现，主人公 Jack 早上睡了 1 秒钟然后吃了个早餐又睡了 1 秒钟，就开始吃午餐，最后吃了晚餐，良好的作息习惯可以让您身体健康噢～，可以点击 '
                }
                endNode={
                  <>
                    {' '}
                    <a
                      href='javascript:void(0)'
                      onClick={() => {
                        commandService.executeCommand('ai.runAndDebug');
                      }}
                    >
                      run
                    </a>{' '}
                    运行看看
                  </>
                }
              />
            </div>,
          );
        },
      },
      {
        with: '运行代码出现这个错误',
        exec: async () => {
          const content = `  eat(...foods: string[]) {
    this.taskList.push(() => {
      console.log(\`Eat $\{[...foods]}\`);
      this.next();
    });
    return this; // 实现链式调用
  }`;

          return createMessageByAI(
            <div>
              <AiReply
                text={'这是因为你的 eat 方法只接收一个参数，可以像这样修改使其支持多个参数'}
                endNode={
                  <>
                    <SyntaxHighlighter language={'tsx'}>{content}</SyntaxHighlighter>
                    <a
                      href='javascript:void(0)'
                      onClick={() => {
                        commandService.executeCommand('ai.chat.replaceContent.eat', content);
                      }}
                    >
                      一键应用
                    </a>
                  </>
                }
              />
            </div>,
          );
        },
      },
      {
        with: '解释一下当前我选中的这段代码',
        exec: async () =>
          createMessageByAI(
            <AiReply
              text={
                '好的，这段代码是 LazyMan 类的构造函数，作用是初始化 LazyMan 实例的属性，将传入构造函数的 name 参数赋值给实例的 name 属性。然后将一个匿名函数添加到 taskList 任务列表中。\n\n 该函数会首先打印 "Hi, I\'m XXX" 这个字符串，其中 XXX 为该实例的 name 属性值。然后调用 next() 方法，继续执行下一个任务。使用 setTimeout() 函数创建一个新的任务。\n\n由于 setTimeout() 函数是异步执行的，所以该任务将会被放到事件队列的最后执行，即等到当前执行栈执行完毕后再执行。\n\n在这里，我们使用了一个延迟时间为 0 毫秒的 setTimeout()，这样可以确保在任务列表中添加了第一个任务之后，马上执行该任务，保证第一个任务能够被添加到任务列表中。该任务会调用 next() 方法，开始执行任务列表中的任务。'
              }
              endNode={
                <SyntaxHighlighter language={'tsx'}>{`this.name = name;
this.taskList.push(() => {
  console.log(\`Hi, I'm $\{this.name}\`);
  this.next();
});

setTimeout(() => {
  this.next();
}, 0);`}</SyntaxHighlighter>
              }
            />,
          ),
      },
      {
        with: '提交全部代码',
        exec: async () =>
          createMessageByAI(
            <div>
              <div>代码已经全部提交，是否创建 PR？</div>
              <br />
              <a
                href='javascript:void(0)'
                onClick={() => {
                  handleSend('创建合并请求');
                }}
              >
                好的
              </a>
              &nbsp;&nbsp;&nbsp;&nbsp;
              <a href='javascript:void(0)'>不了</a>
            </div>,
          ),
      },
      {
        with: '创建合并请求',
        exec: async () => createMessageByAI('是想要合入 master 分支吗？'),
      },
      {
        with: '创建 合并请求',
        exec: async () =>
          createMessageByAI(
            <div>
              <span>代码还未提交，是否需要提交全部代码呢？</span>
              <br />
              <a
                href='javascript:void(0)'
                onClick={() => {
                  handleSend('提交全部代码');
                }}
              >
                好的
              </a>
              &nbsp;&nbsp;&nbsp;&nbsp;
              <a href='javascript:void(0)'>我自己来</a>
            </div>,
          ),
      },
      {
        with: '是的',
        exec: async () =>
          createMessageByAI(
            <div>
              <span>
                好的，已创建合并请求（
                {
                  <a href='https://code.alipay.com/cloud-ide/crew-dragon/pull_requests/180' target='_blank'>
                    链接
                  </a>
                }
                ）
              </span>
              <br />
              <br />
              {/* 字体变粗 */}
              <div>
                <span style={{ fontWeight: 'bold' }}>目标分支: </span>
                <span>master</span>
              </div>
              <div>
                <span style={{ fontWeight: 'bold' }}>标题: </span>
                <span>实现 lazyman 类</span>
              </div>
              <br />
              <div>
                <span style={{ fontWeight: 'bold' }}>描述: </span>
                <span>AI 助手实现的 lazyman 类</span>
              </div>
              <br />
              <div>
                <span style={{ fontWeight: 'bold' }}>评审人: </span>
                <span>蛋总、古铜、彦熹、倾一</span>
              </div>
            </div>,
          ),
      },
      {
        with: '合入 main 分支',
        exec: async () =>
          createMessageByAI(
            <div>
              <span>
                好的，已更新合并请求（
                {
                  <a href='https://code.alipay.com/cloud-ide/crew-dragon/pull_requests/180' target='_blank'>
                    链接
                  </a>
                }
                ）
              </span>
              <br />
              <br />
              {/* 字体变粗 */}
              <div>
                <span style={{ fontWeight: 'bold' }}>目标分支: </span>
                <span>main</span>
              </div>
              <div>
                <span style={{ fontWeight: 'bold' }}>标题: </span>
                <span>实现 lazyman 类</span>
              </div>
              <br />
              <div>
                <span style={{ fontWeight: 'bold' }}>描述: </span>
                <span>AI 助手实现的 lazyman 类</span>
              </div>
              <br />
              <div>
                <span style={{ fontWeight: 'bold' }}>评审人: </span>
                <span>蛋总、古铜、彦熹、倾一</span>
              </div>
            </div>,
          ),
      },
      {
        with: '评审人去掉',
        exec: async () =>
          createMessageByAI(
            <div>
              <span>
                好的，已更新（
                {
                  <a href='https://code.alipay.com/cloud-ide/crew-dragon/pull_requests/180' target='_blank'>
                    链接
                  </a>
                }
                ）
              </span>
              <br />
              <br />
              {/* 字体变粗 */}
              <div>
                <span style={{ fontWeight: 'bold' }}>目标分支: </span>
                <span>main</span>
              </div>
              <div>
                <span style={{ fontWeight: 'bold' }}>标题: </span>
                <span>实现 lazyman 类</span>
              </div>
              <br />
              <div>
                <span style={{ fontWeight: 'bold' }}>描述: </span>
                <span>AI 助手实现的 lazyman 类</span>
              </div>
              <br />
              <div>
                <span style={{ fontWeight: 'bold' }}>评审人: </span>
                <span>蛋总、古铜、彦熹</span>
              </div>
            </div>,
          ),
      },
      {
        with: '字体大小',
        exec: async (value: string) => {
          // 字符串提取数字
          const num = value.replace(/[^0-9]/gi, '');
          preferenceService.set('editor.fontSize', num);
          return createMessageByAI('字体大小已更新～');
        },
      },
    ],
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

        if (userInput.type === AISerivceType.Search || userInput.type === AISerivceType.SearchCode) {
          aiMessage = await AISearch(userInput, aiGPTBackService);
        } else if (userInput.type === AISerivceType.Sumi) {
          aiMessage = await aiChatService.messageWithSumi(userInput.message!);
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
