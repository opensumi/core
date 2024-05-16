import { Readable } from 'stream';

import { Autowired, Injectable } from '@opensumi/di';
import {
  BaseAIBackService,
  CancellationToken,
  ChatReadableStream,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  IAICompletionOption,
  INodeLogger,
  sleep,
} from '@opensumi/ide-core-node';

export interface ReqeustResponse extends IAIBackServiceResponse {
  responseText?: string;
  urlMessage?: string;
  data: string;
}

@Injectable()
export class AiBackService extends BaseAIBackService implements IAIBackService<ReqeustResponse, ChatReadableStream> {
  @Autowired(INodeLogger)
  protected readonly logger: INodeLogger;

  private streamSessionIdMap = new Map<string, Readable>();

  override async destroyStreamRequest(sessionId: string) {
    if (this.streamSessionIdMap.has(sessionId)) {
      const stream = this.streamSessionIdMap.get(sessionId);
      stream?.destroy();
    }
  }

  override async request(input: string, options: IAIBackServiceOption, cancelToken?: CancellationToken) {
    await sleep(1000);

    if (options.type === 'rename') {
      return Promise.resolve({
        errorCode: 0,
        data: '```typescript\nnewName\nhaha```',
      });
    }

    return Promise.resolve({
      errorCode: 0,
      data: 'Hello OpenSumi!',
    });
  }

  async requestCompletion(input: IAICompletionOption, cancelToken?: CancellationToken | undefined): Promise<{ sessionId: string; codeModelList: { content: string; }[]; }> {
    return {
      sessionId: '123',
      codeModelList: [
        {
          content: 'Hello OpenSumi!'
        }
      ]
    }
  }

  override async requestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<ChatReadableStream> {
    const { requestId } = options;

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

    const chatReadableStream = new ChatReadableStream();

    cancelToken?.onCancellationRequested(() => {
      chatReadableStream.end();
    });

    // 模拟数据事件
    streamData.forEach((chunk, index) => {
      setTimeout(() => {
        if (length - 1 === index || cancelToken?.isCancellationRequested) {
          chatReadableStream.end();
          return;
        }

        chatReadableStream.emitData({ kind: 'content', content: chunk.toString() });
      }, index * 300);
    });

    return chatReadableStream;
  }
}
