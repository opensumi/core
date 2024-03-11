import { Readable } from 'stream';

import { Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import {
  CancellationToken,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  IAICompletionOption,
  IAICompletionResultModel,
  IAIReportCompletionOption,
  sleep,
} from '@opensumi/ide-core-common';

interface IRPCGptService {
  onMessage(msg: string, sessionId?: string): void;
}

@Injectable()
export class BaseAIBackService
  extends RPCService<IRPCGptService>
  implements IAIBackService<IAIBackServiceResponse, Readable>
{
  async request<T = IAIBackServiceResponse<string>>(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<T> {
    // mock request
    await sleep(1000);
    return Promise.resolve({
      errorCode: 0,
      data: 'Hello OpenSumi!',
    } as T);
  }
  async requestStream<T = IAIBackServiceResponse<string>>(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<T> {
    const { sessionId } = options;

    // 模拟 stream 数据,包含一段 TypeScript 代码
    const streamData = [
      'Here is a simple TypeScript code snippet: \n',
      '```typescript\n',
      'interface Person {\n',
      '  name: string;\n',
      '  age: number;\n',
      '}\n',
      '\n',
      'const person: Person = {\n',
      '  name: "John Doe",\n',
      '  age: 30\n',
      '};\n',
      '\n',
      'function greet(person: Person) {\n',
      '  console.log(`Hello, ${person.name}!`);\n',
      '}\n',
      '\n',
      'greet(person); // Output: "Hello, John Doe!"\n',
      '```\n',
      'This code defines a Person interface and creates an object that implements it.',
      'It then defines a function that takes a Person object and logs a greeting.',
      'Make sure to handle the stream data properly in your application.',
    ];

    const length = streamData.length;

    // 创建可读流
    const stream = new Readable({
      read() {},
    });

    // 模拟数据事件
    streamData.forEach((chunk, index) => {
      setTimeout(() => {
        stream.push(
          JSON.stringify({
            id: sessionId,
            choices: [
              {
                delta: {
                  content: chunk,
                  role: 'user',
                },
                finish_reason: length - 1 === index ? 'stop' : null,
              },
            ],
          }),
        );
      }, index * 300);
    });

    // 在数据事件中处理数据
    stream.on('data', (chunk) => {
      // console.log(`Received chunk: ${chunk}`);
      this.client?.onMessage(chunk, sessionId);
    });

    // 在结束事件中进行清理
    stream.on('end', () => {
      // console.log('Stream ended.');
    });

    // 触发结束事件
    setTimeout(() => {
      stream.push(null);
    }, streamData.length * 1000);

    return void 0 as T;
  }

  async requestCompletion<T = IAICompletionResultModel>(input: IAICompletionOption, cancelToken?: CancellationToken) {
    return void 0 as T;
  }

  async reportCompletion<T = IAIReportCompletionOption>(input: IAIReportCompletionOption) {}

  async destroyStreamRequest(sessionId: string) {}
}
