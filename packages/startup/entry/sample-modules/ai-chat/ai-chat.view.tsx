import * as React from 'react';

import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import "react-chat-elements/dist/main.css"

import * as styles from './ai-chat.module.less';
import { MessageList, SystemMessage } from "react-chat-elements"
import { Button, Input } from '@opensumi/ide-core-browser/lib/components';
import { Loading } from '@opensumi/ide-core-browser/lib/components/loading';
import { CommandService } from '@opensumi/ide-core-common';
import { PreferenceService, useInjectable } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import hljs from 'highlight.js';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { AiChatService } from './ai-chat.service';
import { EditorPreferences } from '@opensumi/ide-editor/lib/browser';

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
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [inputValue, setInputValue] = React.useState('');
  const [messageListData, setMessageListData] = React.useState<any[]>([createMessage('left', AI_NAME, `你好～ AI 助手为您服务！`)]);
  const [loading, setLoading] = React.useState(false);

  const [, updateState] = React.useState<any>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  React.useEffect(() => {
    const dispose = aiChatService.onChatMessageLaunch(async (message) => {
      await handleSend(message);
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

          const error = await commandService.executeCommand('ai.chat.createNewFile', fileName);
          if (error) {
            return createMessageByAI(<AiReply text={'文件已存在，无法重复创建噢'} />);
          }
          return createMessageByAI(<AiReply text={'文件已经新建好啦～'} />);
        }
      },
      {
        with: 'http 服务',
        exec: async (s) => {
          // 字符串提取数字
          const num = s.replace(/[^0-9]/ig, "");
          await commandService.executeCommand('ai.chat.createNodeHttpServerContent', num);

          return createMessageByAI(<div>
            <AiReply text={'已为你创建了一个 node http 服务的代码示例，端口号为 8888，可点击'} endNode={<> <a href='javascript:void(0)' onClick={() => {
              commandService.executeCommand('ai.runAndDebug')
            }}> run</a> 运行～</>} />
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
      {
        with: 'lazyman',
        exec: async (value: string) => {
          await commandService.executeCommand('ai.chat.createNewFile', 'lazyman.ts');

          await sleep(2000);

          await commandService.executeCommand('ai.chat.createLazymanContent');

          return createMessageByAI(<div>
            <AiReply text={'已为你设计好了 lazyman 的实现，主人公 Jack 早上睡了 1 秒钟然后吃了个早餐又睡了 1 秒钟，就开始吃午餐，最后吃了晚餐，良好的作息习惯可以让您身体健康噢～，可以点击 '} endNode={<> <a href='javascript:void(0)' onClick={() => {
              commandService.executeCommand('ai.runAndDebug')
            }}>run</a> 运行看看</>} />
          </div>);
        }
      },
      {
        with: '运行代码出现这个错误',
        exec: async (value: string) => {
          const content = `  eat(...foods: string[]) {
    this.taskList.push(() => {
      console.log(\`Eat $\{[...foods]\}\`);
      this.next();
    });
    return this; // 实现链式调用
  }`

          return createMessageByAI(<div>
            <AiReply text={'这是因为你的 eat 方法只接收一个参数，可以像这样修改使其支持多个参数'} endNode={<><SyntaxHighlighter language={'tsx'}>{content}</SyntaxHighlighter><a href='javascript:void(0)' onClick={() => {
              commandService.executeCommand('ai.chat.replaceContent.eat', content)
            }}>一键应用</a></>} />
          </div>);
        }
      },
      {
        with: '解释一下当前我选中的这段代码',
        exec: async (value: string) => {
          return createMessageByAI(<AiReply text={
            `好的，这段代码是 LazyMan 类的构造函数，作用是初始化 LazyMan 实例的属性，将传入构造函数的 name 参数赋值给实例的 name 属性。然后将一个匿名函数添加到 taskList 任务列表中。\n\n 该函数会首先打印 "Hi, I'm XXX" 这个字符串，其中 XXX 为该实例的 name 属性值。然后调用 next() 方法，继续执行下一个任务。使用 setTimeout() 函数创建一个新的任务。\n\n由于 setTimeout() 函数是异步执行的，所以该任务将会被放到事件队列的最后执行，即等到当前执行栈执行完毕后再执行。\n\n在这里，我们使用了一个延迟时间为 0 毫秒的 setTimeout()，这样可以确保在任务列表中添加了第一个任务之后，马上执行该任务，保证第一个任务能够被添加到任务列表中。该任务会调用 next() 方法，开始执行任务列表中的任务。`}
            endNode={<SyntaxHighlighter language={'tsx'}>{`this.name = name;
this.taskList.push(() => {
  console.log(\`Hi, I'm $\{this.name\}\`);
  this.next();
});

setTimeout(() => {
  this.next();
}, 0);`}</SyntaxHighlighter>}
            />)
        }
      },
      {
        with: '提交全部代码',
        exec: async (value: string) => {
          return createMessageByAI(<div>
            <div>代码已经全部提交，是否创建 PR？</div>
            <br />
            <a href='javascript:void(0)' onClick={() => {
              handleSend('创建合并请求')
            }}>好的</a>&nbsp;&nbsp;&nbsp;&nbsp;
            <a href='javascript:void(0)'>不了</a>
          </div>)
        }
      },
      {
        with: '创建合并请求',
        exec: async (value: string) => {
          return createMessageByAI('是想要合入 master 分支吗？')
        }
      },
      {
        with: '创建 合并请求',
        exec: async (value: string) => {
          return createMessageByAI(<div>
            <span>代码还未提交，是否需要提交全部代码呢？</span>
            <br />
            <a href='javascript:void(0)' onClick={() => {
              handleSend('提交全部代码')
            }}>好的</a>&nbsp;&nbsp;&nbsp;&nbsp;
            <a href='javascript:void(0)'>我自己来</a>
          </div>)
        }
      },
      {
        with: '是的',
        exec: async (value: string) => {
          return createMessageByAI(<div>
            <span>好的，已创建合并请求（{<a href='https://code.alipay.com/cloud-ide/crew-dragon/pull_requests/180' target='_blank'>链接</a>}）</span>
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
          </div>)
        }
      },
      {
        with: '合入 main 分支',
        exec: async (value: string) => {
          return createMessageByAI(<div>
            <span>好的，已更新合并请求（{<a href='https://code.alipay.com/cloud-ide/crew-dragon/pull_requests/180' target='_blank'>链接</a>}）</span>
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
          </div>)
        }
      },
      {
        with: '评审人去掉',
        exec: async (value: string) => {
          return createMessageByAI(<div>
            <span>好的，已更新（{<a href='https://code.alipay.com/cloud-ide/crew-dragon/pull_requests/180' target='_blank'>链接</a>}）</span>
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
          </div>)
        }
      },
      {
        with: '字体大小',
        exec: async (value: string) => {
          // 字符串提取数字
          const num = value.replace(/[^0-9]/ig, "");
          preferenceService.set('editor.fontSize', num);
          return createMessageByAI('字体大小已更新～')
        }
      },
      {
        with: '更改主题',
        exec: async (value: string) => {
          const themes = [
            {
                "label": "GitHub Light Default",
                "value": "vs vscode-theme-themes-light-default-json",
                "groupLabel": "浅色主题"
            },
            {
                "label": "GitHub Light Colorblind (Beta)",
                "value": "vs vscode-theme-themes-light-colorblind-json"
            },
            {
                "label": "GitHub Light",
                "value": "vs vscode-theme-themes-light-json"
            },
            {
                "label": "Light+ (default light)",
                "value": "Default Light+"
            },
            {
                "label": "Light (Visual Studio)",
                "value": "Visual Studio Light"
            },
            {
                "label": "Quiet Light",
                "value": "Quiet Light"
            },
            {
                "label": "Solarized Light",
                "value": "Solarized Light"
            },
            {
                "label": "GitHub Dark Default",
                "value": "vs-dark vscode-theme-themes-dark-default-json",
                "groupLabel": "深色主题"
            },
            {
                "label": "GitHub Dark Colorblind (Beta)",
                "value": "vs-dark vscode-theme-themes-dark-colorblind-json"
            },
            {
                "label": "GitHub Dark Dimmed",
                "value": "vs-dark vscode-theme-themes-dark-dimmed-json"
            },
            {
                "label": "GitHub Dark",
                "value": "vs-dark vscode-theme-themes-dark-json"
            },
            {
                "label": "One Dark Pro",
                "value": "vs-dark vscode-theme-themes-OneDark-Pro-json"
            },
            {
                "label": "Kimbie Dark",
                "value": "Kimbie Dark"
            },
            {
                "label": "Abyss",
                "value": "Abyss"
            },
            {
                "label": "Dark+ (default dark)",
                "value": "Default Dark+"
            },
            {
                "label": "Dark (Visual Studio)",
                "value": "Visual Studio Dark"
            },
            {
                "label": "Red",
                "value": "Red"
            },
            {
                "label": "Monokai Dimmed",
                "value": "Monokai Dimmed"
            },
            {
                "label": "Solarized Dark",
                "value": "Solarized Dark"
            },
            {
                "label": "Monokai",
                "value": "Monokai"
            },
            {
                "label": "Tomorrow Night Blue",
                "value": "Tomorrow Night Blue"
            },
            {
                "label": "GitHub Light High Contrast",
                "value": "hc-black vscode-theme-themes-light-high-contrast-json",
                "groupLabel": "高对比度主题"
            },
            {
                "label": "GitHub Dark High Contrast",
                "value": "hc-black vscode-theme-themes-dark-high-contrast-json"
            },
            {
                "label": "Dark High Contrast",
                "value": "Default High Contrast"
            },
            {
                "label": "Light High Contrast",
                "value": "Default High Contrast Light"
            }
        ]
          return createMessageByAI(<div>
            <span>已为您列出所有主题，请选择您要更改的主题:</span>
            <br />
            <ul style={{padding: 0}}>
              {themes.map(({label, value}) => {
                return <li key={value}><a href='javascript:void(0)' onClick={() => {
                  preferenceService.set('general.theme', value);
                }}>{label}</a></li>
              })}
            </ul>
          </div>)
        }
      }
    ]
  }, [])

  const handleSend = React.useCallback(async (value?: any) => {
    const preMessagelist = messageListData;
    const preInputValue = value || inputValue;

    if (containerRef && containerRef.current) {
      containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
    }

    setLoading(true);
    setInputValue('');

    preMessagelist.push(createMessage('right', ME_NAME, preInputValue));
    setMessageListData(preMessagelist);

    await sleep(1000);

    setLoading(false);

    for await (const { with: _with, exec } of switchTask) {
      let v = typeof preInputValue === 'string' ? preInputValue : preInputValue.props.children[0];

      if (v.includes(_with)) {
        const msg = await exec(preInputValue);
        preMessagelist.push(msg)
        setMessageListData(preMessagelist);
        updateState({})
        if (containerRef && containerRef.current) {
          containerRef.current.scrollTop = Number.MAX_SAFE_INTEGER;
        }
        return;
      }
    }

  }, [messageListData, inputValue, containerRef])

  React.useEffect(() => {
    document.querySelectorAll("pre code").forEach(block => {
      // @ts-ignore
      try { hljs.highlightBlock(block); }
      catch (e) { console.log(e); }
    });
  }, []);

  return (
    <div
      id={VIEW_CONTAINERS.RIGHT_TABBAR}
      className={styles.ai_chat_view}
    >
      <div className={styles.container} ref={containerRef}>
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
        <Button onClick={() => handleSend()}>Send</Button>
      </div>
    </div>
  )
};


// AI 回复组件，就是能一个字一个出现的那种效果
const AiReply = ({ text, endNode = <></> }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [currentText, setCurrentText] = React.useState('');

  React.useEffect(() => {
    if (currentIndex < text.length) {
      let timeoutId

      timeoutId = setTimeout(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        setCurrentText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, Math.floor(Math.random() * 41) + 10);

      return () => clearTimeout(timeoutId);
    }

  }, [currentIndex, text]);

  return <div style={{whiteSpace: 'break-spaces'}}>{
    currentIndex === text.length
      ? <>{currentText}{endNode}</>
      : currentText}
  </div>;
}
