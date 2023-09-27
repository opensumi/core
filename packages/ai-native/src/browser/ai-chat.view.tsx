import { observer } from 'mobx-react-lite';
import * as React from 'react';
// @ts-ignore
import { Avatar, MessageList, SystemMessage } from 'react-chat-elements';

import { DefaultMarkedRenderer, Markdown } from '@opensumi/ide-components/lib/markdown/index';
import { AppConfig, getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Button, Icon, Popover } from '@opensumi/ide-core-browser/lib/components';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { CommandOpener } from '@opensumi/ide-core-browser/lib/opener/command-opener';
import { Command, isMacintosh, URI } from '@opensumi/ide-core-common';
import 'react-chat-elements/dist/main.css';

import { AiGPTBackSerivcePath, AISerivceType, IChatMessageStructure } from '../common';

import * as styles from './ai-chat.module.less';
import { AiChatService } from './ai-chat.service';
import { AiProjectGenerateService } from './ai-project/generate.service';
import { AiSumiService } from './ai-sumi/sumi.service';
import { CodeBlockWrapper } from './components/ChatEditor';
import { ChatInput } from './components/ChatInput';
import { ChatMoreActions } from './components/ChatMoreActions';
import { LineVertical } from './components/lineVertical';
import { Thinking } from './components/Thinking';
import { AiRunService } from './run/run.service';

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

export const AiChatView = observer(() => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const aiProjectGenerateService = useInjectable<AiProjectGenerateService>(AiProjectGenerateService);
  const aiSumiService = useInjectable<AiSumiService>(AiSumiService);
  const aiGPTBackService = useInjectable<any>(AiGPTBackSerivcePath);
  const aiRunService = useInjectable<AiRunService>(AiRunService);
  const opener = useInjectable<CommandOpener>(CommandOpener);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [messageListData, setMessageListData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [, updateState] = React.useState<any>();
  // 项目生成
  const generateProject = React.useCallback(async () => {
    await aiProjectGenerateService.clearWorkspace();

    const loadingText = createMessageByAI(<div>项目生成中，请稍后....</div>);
    // 项目分析结果
    const { language, framework } = aiProjectGenerateService.requirements!;
    const languageReply = createMessageByAI(<AiReply text={`项目语言为：${language}\n使用框架：${framework}`} immediately={true} />);
    setMessageListData([languageReply, loadingText]);

    const filePathList = await aiProjectGenerateService.generateProjectStructure();
    const structureReply = createMessageByAI(<AiReply text={`项目结构为:\n${filePathList.join('\n')}`} immediately={true} />);
    setMessageListData([languageReply, structureReply, loadingText]);

    const generatedFilePathList: string[] = [];
    await aiProjectGenerateService.generateFile(filePathList, (file: string) => {
      const currentFileReply = createMessageByAI(<AiReply text={`正在生成文件:${file}`} />);
      const generatedReply = createMessageByAI(<AiReply text={`已生成文件:\n${generatedFilePathList.join('\n')}`} />);
      setMessageListData([languageReply, structureReply, generatedReply, currentFileReply, loadingText]);
      generatedFilePathList.push(file);
    });

    const successMessage = createMessageByAI(<div>项目生成完毕</div>);
    setMessageListData([languageReply, structureReply, successMessage]);
    localStorage.removeItem('ai-generate');
  }, []);

  React.useEffect(() => {
    if (aiProjectGenerateService.requirements) {
      generateProject();
    }
  }, [aiProjectGenerateService.requirements]);

  const InitMsgComponent = () => {
    const lists = [
      // { icon: getIcon('plus'), text: '生成 Java 快排算法' },
      // { icon: getIcon('branches'), text: '提交代码' },
      // { icon: getIcon('open-changes'), text: '创建合并请求' },
      // { icon: getIcon('scm'), text: '触发流水线' },
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
                aiChatService.launchChatMessage({ message: data.text });
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
    setMessageListData([firstMsg]);

    const dispose = aiChatService.onChatMessageLaunch(async (message) => {
      await handleSend(message);
    });
    // aiChatService.removeOldExtension();
    return () => dispose.dispose();
  }, []);

  const handleSend = React.useCallback(
    async (value: IChatMessageStructure) => {
      const { message, prompt } = value;

      const preMessagelist = messageListData;
      const preInputValue = message;

      if (containerRef && containerRef.current) {
        containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
      }

      setLoading(true);

      preMessagelist.push(createMessage('right', ME_NAME, preInputValue));
      setMessageListData(preMessagelist);
      // 检查前缀 aiSearchKey
      if (typeof preInputValue === 'string') {
        let aiMessage;

        const userInput = await aiChatService.switchAIService(preInputValue, prompt);

        if (userInput!.type === AISerivceType.Search) {
          aiMessage = await AISearch(userInput, aiGPTBackService);
        } else if (userInput!.type === AISerivceType.Sumi) {
          aiMessage = await aiSumiService.message(userInput!.message!);

          aiMessage = await AIWithCommandReply(aiMessage, opener);
        } else if (userInput!.type === AISerivceType.GPT) {
          aiMessage = await aiChatService.messageWithGPT(userInput!.message!);
          aiMessage = await AIChatGPTReply(aiMessage);
        } else if (userInput!.type === AISerivceType.Explain) {
          aiMessage = await aiChatService.messageWithGPT(userInput!.message!);
          aiMessage = await AIChatGPTReply(aiMessage);
        } else if (userInput!.type === AISerivceType.Run) {
          aiMessage = await aiChatService.aiBackService.aiAntGlm(userInput!.message!);
          aiMessage = await AIChatRunReply(aiMessage.data, aiRunService);
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

  const layoutViewSize = React.useMemo(() => appConfig.layoutViewSize || LAYOUT_VIEW_SIZE, [appConfig]);

  const viewHeight = React.useMemo(
    () => `calc(100vh - ${layoutViewSize.MENUBAR_HEIGHT + layoutViewSize.STATUSBAR_HEIGHT}px)`,
    [],
  );

  return (
    <div className={styles.ai_chat_view} style={{ height: viewHeight }}>
      <div className={styles.header_container}>
        <div className={styles.left}>
          <div className={styles.ai_avatar_icon}>
            <Avatar src={AI_AVATAR} className={styles.ai_chat_avatar_icon} />
          </div>
          <span className={styles.title}>{AI_NAME}</span>
          <LineVertical />
          <span className={styles.des}>Chat</span>
        </div>
        <div className={styles.right}>
          <Popover id={'ai-chat-header-clear'} title='清空'>
            <Icon className={getIcon('clear')} />
          </Popover>
          <Popover id={'ai-chat-header-close'} title='关闭'>
            <Icon className={getIcon('close')} />
          </Popover>
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
          <ChatInput onSend={(value) => handleSend({ message: value })} />
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

const AISearch = async (input, aiGPTBackService) => {
  try {
    const result = await aiGPTBackService.aiSearchRequest(input.message, input.type === 'overall');

    const { responseText, urlMessage } = result;

    const aiMessage = createMessageByAI(
      <ChatMoreActions>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div>
            <CodeBlockWrapper text={responseText} />
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            <Markdown value={urlMessage} renderer={codeSearchMarkedRender}></Markdown>
            {/* {AIChatGPTReply(urlMessage)} */}
          </div>
        </div>
      </ChatMoreActions>,
    );

    return aiMessage;
  } catch (error) {}
};

// 带有代码的 AI 回复组件
const AIChatGPTReply = async (input) => {
  try {
    const aiMessage = createMessageByAI(
      <ChatMoreActions>
        <CodeBlockWrapper text={input} />
      </ChatMoreActions>,
    );

    return aiMessage;
  } catch (error) {}
};

// run 的 AI 回复组件
const AIChatRunReply = async (input, aiRunService: AiRunService) => {
  try {
    const RenderAnswer = aiRunService.answerComponentRender();

    const aiMessage = createMessageByAI(
      <ChatMoreActions>
        {RenderAnswer ? <RenderAnswer input={input} /> : <CodeBlockWrapper text={input} />}
      </ChatMoreActions>,
    );

    return aiMessage;
  } catch (error) {}
};

// 带有命令按钮的 AI 回复
const AIWithCommandReply = async (command: Command, opener) => {
  try {
    if (!command) {
      return createMessageByAI('未找到合适的功能');
    }

    const { labelLocalized, label, delegate, id } = command;

    const aiMessage = createMessageByAI(
      <ChatMoreActions>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div>已在系统内找到适合功能: {labelLocalized?.localized || label}，可以按以下步骤尝试：</div>
          <ol style={{ margin: '8px 0' }}>
            <li style={{ listStyle: 'inherit' }}>打开命令面板：({isMacintosh ? 'cmd' : 'ctrl'} + shift + p)</li>
            <li style={{ listStyle: 'inherit' }}>输入：{labelLocalized?.localized || label}</li>
          </ol>
          <Button onClick={() => opener.open(URI.parse(`command:${delegate || id}`))}>点击执行命令</Button>
        </div>
      </ChatMoreActions>,
    );

    return aiMessage;
  } catch (error) {}
};
