import { Injectable, Autowired } from '@opensumi/di';
import { CancellationToken } from '@opensumi/ide-utils';
import OpenAI from 'openai';
import { ChatCompletionStream } from 'openai/lib/ChatCompletionStream';
import nodeFetch from 'node-fetch';
import { RunnableToolFunctionWithoutParse } from 'openai/lib/RunnableFunction';
import { ToolInvocationRegistry, ToolInvocationRegistryImpl, ToolRequest } from '../../common/tool-invocation-registry';
import { ChatReadableStream } from '@opensumi/ide-core-node';
import { pipeline, Writable } from 'stream';

export const CodeFuseModelIdentifier = Symbol('CodeFuseModelIdentifier');

const config = {
  CODE_GPT: {
    host: '', // 正式环境
    preHost: '', // 预发环境
    user: 'ai_native_ide',
    token: '',
  }
};

@Injectable()
export class CodeFuseAIModel {
  @Autowired(ToolInvocationRegistry)
  private readonly toolInvocationRegistry: ToolInvocationRegistryImpl;

  async request(messages: string, cancellationToken?: CancellationToken): Promise<any> {
    const model = 'CODEGPT';
    const chatReadableStream = new ChatReadableStream();

    const { user, token } = config.CODE_GPT;
    const controller = new AbortController();
    const signal = controller.signal as any;

    // 在取消令牌被请求时中止请求
    cancellationToken?.onCancellationRequested(() => {
      controller.abort();
    });

    const generateEventStreamData = (data: string) => {
      if (data.startsWith('data: ')) {
        return data.split('data: ')[1];
      }
      return data;
    };

    const body = {
      messages: [{ role: 'user', content: messages }],
      stream: true,
      chatRequestExtData: {
        bizId: config.CODE_GPT.user,
        empId: '281705',
      },
      model,
      functions: this.toolInvocationRegistry.getAllFunctions(),
    };
    console.log("🚀 ~ CodeFuseAIModel ~ request ~ body:", JSON.stringify(body, null, 2));

    const request = await nodeFetch(
      `${config.CODE_GPT.host}/api/chat/${model}/completion`,
      {
        signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          codegpt_user: user,
          codegpt_token: token,
        },
        body: JSON.stringify(body),
      },
    );

    pipeline(request.body, new Writable({
      write: (chunk, _, callback) => {
        const data = new TextDecoder().decode(chunk as Buffer);
        console.log('fetch stream model chunk', data);

        const pickData = generateEventStreamData(data);

        try {
          const toObj = JSON.parse(pickData);

          chatReadableStream.emitData({
            kind: 'content',
            content: toObj?.choices[0]?.delta?.content || '',
          });
        } catch (error) {
          console.log('fetch stream model chunk failed', error);
        }

        callback();
      },
      final: (callback) => {
        chatReadableStream.end();
        console.log('fetch stream model success', model);
        callback();
      },
    }), (error) => {
      if (error) {
        console.log('fetch stream model failed', error);
        if (error.name === 'AbortError') {
          chatReadableStream.emitError(new Error('Readable Stream Abort'));
        } else {
          // 处理其他错误，可以选择重试请求或推送错误事件到stream并关闭stream
          chatReadableStream.emitError(error);
        }
      }
    });

    return chatReadableStream;
  }
}
