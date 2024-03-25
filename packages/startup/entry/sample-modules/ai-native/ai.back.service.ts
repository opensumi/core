import { Readable } from 'stream';

import { Autowired, Injectable } from '@opensumi/di';
import {
  BaseAIBackService,
  CancellationToken,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  INodeLogger,
  sleep,
} from '@opensumi/ide-core-node';

export interface ReqeustResponse extends IAIBackServiceResponse {
  responseText?: string;
  urlMessage?: string;
  data: string;
}

@Injectable()
export class AiBackService extends BaseAIBackService implements IAIBackService<ReqeustResponse, Readable> {
  @Autowired(INodeLogger)
  protected readonly logger: INodeLogger;

  private streamSessionIdMap = new Map<string, Readable>();

  override async destroyStreamRequest(sessionId: string) {
    if (this.streamSessionIdMap.has(sessionId)) {
      const stream = this.streamSessionIdMap.get(sessionId);
      stream?.destroy();
    }
  }

  override async request<T = IAIBackServiceResponse<string>>(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<T> {
    await sleep(1000);

    if (options.type === 'rename') {
      return Promise.resolve({
        errorCode: 0,
        data: '```typescript\nnewName\nhaha```',
      } as T);
    }

    return Promise.resolve({
      errorCode: 0,
      data: 'Hello OpenSumi!',
    } as T);
  }

  override async requestStream<T = IAIBackServiceResponse<string>>(
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
      ' #Command#: du -sh *\n',
      ' #Description#: 查看当前文件夹下所有文件和子文件夹的大小\n',
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

    if (sessionId) {
      this.streamSessionIdMap.set(sessionId, stream);
    }

    // 在数据事件中处理数据
    stream.on('data', (chunk) => {
      this.logger.log(`Received chunk: ${chunk}`);
      this.client?.onMessage(chunk, sessionId);
    });

    // 在结束事件中进行清理
    stream.on('close', () => {
      this.logger.log('Stream ended.');
      if (sessionId) {
        this.streamSessionIdMap.delete(sessionId);
      }
    });

    // 触发结束事件
    setTimeout(() => {
      stream.push(null);
    }, streamData.length * 1000);

    return void 0 as T;
  }
}
