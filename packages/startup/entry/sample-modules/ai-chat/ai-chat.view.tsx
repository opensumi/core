import * as React from 'react';

import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import "react-chat-elements/dist/main.css"

import * as styles from './ai-chat.module.less';
import { MessageList, SystemMessage } from "react-chat-elements"
import { Button, Input } from '@opensumi/ide-core-browser/lib/components';
import { Loading } from '@opensumi/ide-core-browser/lib/components/loading';
import { CommandService } from '@opensumi/ide-core-common';
import { useInjectable } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import hljs from 'highlight.js';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { AiChatService } from './ai-chat.service';

const createMessage = (position: string, title: string, text: string | React.ReactNode) => {
  return {
    position,
    type: "text",
    title,
    text,
  }
}

const createMessageByAI = (text: string | React.ReactNode) => {
  return createMessage('left', AI_NAME, text)
}

const createMessageByMe = (text: string | React.ReactNode) => {
  return createMessage('right', ME_NAME, text)
}

const AI_NAME = 'AI 助手'
const ME_NAME = '我'

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined)
    }, ms)
  }
  )
}

export const AiChatView = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const workbenchEditorService = useInjectable<WorkbenchEditorServiceImpl>(WorkbenchEditorService);
  const aiChatService = useInjectable<AiChatService>(AiChatService);


  const [inputValue, setInputValue] = React.useState('');
  const [messageListData, setMessageListData] = React.useState<any[]>([createMessage('left', AI_NAME, `你好～ AI 助手为您服务！`)]);
  const [loading, setLoading] = React.useState(false);

  const [, updateState] = React.useState<any>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  React.useEffect(() => {
    const dispose = aiChatService.onChatMessageLaunch(async (message) => {
      const preMessagelist = [...messageListData];
      preMessagelist.push(createMessageByMe(message));
      setMessageListData(preMessagelist);
      forceUpdate();
    })

    return () => dispose.dispose();
  }, [])

  const handleInputChange = React.useCallback((value) => {
    setInputValue(value)
  }, [])

  const switchTask = React.useMemo(() => {
    return [
      {
        with: '新建',
        exec: async (s) => {
          // 字符串提取双引号内的文本
          const fileName = s.match(/"([^"]*)"/)[1];

          await commandService.executeCommand('ai.chat.createNewFile', fileName);
          return createMessageByAI(<AiReply text={'文件已经新建好啦～'} />);
        }
      },
      {
        with: 'http 服务',
        exec: async (s) => {
          // 字符串提取数字
          const num = s.replace(/[^0-9]/ig, "");
          await commandService.executeCommand('ai.chat.createNodeHttpServerContent', num);

          const currentEditor = workbenchEditorService.currentEditor;
          const base = currentEditor?.currentUri?.path.base

          return createMessageByAI(<div>
            已为你创建了一个 node http 服务的代码示例，端口号为 8888，可点击 <a href='javascript:void(0)' onClick={() => {
              commandService.executeCommand('ai.runAndDebug', `node ${base}`)
            }}>run</a> 运行～
          </div>);
        }
      },
      {
        with: '聚焦到',
        exec: async (value: string) => {
          // 字符串提取数字
          const num = value.replace(/[^0-9]/ig, "");
          await commandService.executeCommand('ai.chat.focusLine', num);
          return createMessageByAI('已为您聚焦到第 ' + num + ' 行');
        }
      },
    ]
  }, [])

  const handleSend = React.useCallback(async () => {
    const preMessagelist = [...messageListData];
    const preInputValue = inputValue;

    setLoading(true);
    setInputValue('');

    preMessagelist.push(createMessage('right', ME_NAME, preInputValue));
    setMessageListData(preMessagelist);

    await sleep(1000);

    setLoading(false);

    for await (const { with: _with, exec } of switchTask) {
      if (preInputValue.includes(_with)) {
        const msg = await exec(preInputValue);
        preMessagelist.push(msg)
        setMessageListData(preMessagelist);
        forceUpdate();
        return;
      }
    }

  }, [messageListData, inputValue])

  React.useEffect(() => {
    document.querySelectorAll("pre code").forEach(block => {
      // @ts-ignore
      try { hljs.highlightBlock(block); }
      catch (e) { console.log(e); }
    });
  });

  return (
    <div
      id={VIEW_CONTAINERS.RIGHT_TABBAR}
      className={styles.ai_chat_view}
    >
      <div className={styles.container}>
        {/* @ts-ignore */}
        <MessageList
          className={styles.message_list}
          lockable={true}
          toBottomHeight={'100%'}
          // @ts-ignore
          dataSource={messageListData}
        />
        {/* @ts-ignore */}
        {loading && <SystemMessage title={AI_NAME} className={styles.smsg} text={<div style={{ display: 'flex', alignItems: 'center' }}>
          <Loading></Loading>
          <span>正在生成中...</span>
        </div>}></SystemMessage>}
      </div>
      <div className={styles.chat_input}>
        <Input placeholder="AI 助手为你服务" type={'textarea'} value={inputValue} onValueChange={handleInputChange} className={styles.input_wrapper} />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  )
};


// AI 回复组件，就是能一个字一个出现的那种效果
const AiReply = ({ text }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [currentText, setCurrentText] = React.useState('');

  React.useEffect(() => {
    if (currentIndex < text.length) {
      const timeoutId = setTimeout(() => {
        setCurrentText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, Math.floor(Math.random() * 41) + 10);

      return () => clearTimeout(timeoutId);
    }
  }, [currentIndex, text]);

  return <div>{currentText}</div>;
}
