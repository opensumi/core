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

  override async requestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<Readable> {
    const { sessionId } = options;

    // 模拟 stream 数据,包含一段 TypeScript 代码
    const streamData = [
      'Here is a simple TypeScript code snippet: \n',
      '```\n',
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

    // 模拟原始的 SSE strem
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let messageIndex = 0;
        const pushMessage = () => {
          if (messageIndex < streamData.length) {
            const line = streamData[messageIndex++];
            // 随机切分消息
            const msgs = splitStringRandomly(line);
            for (const msg of msgs) {
              controller.enqueue(encoder.encode(`data: ${msg}`));
            }
            // Schedule next message push
            setTimeout(pushMessage, 250); // Adjust time as needed
          } else {
            controller.close(); // 关闭流，如果不希望自动关闭请移除该行
          }
        };

        pushMessage();
      },
    });

    const readable = readableStreamToNodeReadable(stream);
    if (sessionId) {
      this.streamSessionIdMap.set(sessionId, readable);
    }

    return readable;
  }
}

// 将ReadableStream转化为Node.js的Readable流的函数
function readableStreamToNodeReadable(readableStream) {
  // 创建Node.js的Readable流
  const nodeReadable = new Readable({
    read() {}, // 当流消费者调用read()时，会触发这个函数，这个示例中我们无需自己实现读取逻辑
  });

  // 获取ReadableStream的reader
  const reader = readableStream.getReader();

  // 用一个循环处理流中的所有数据块
  (async function pump() {
    try {
      // ReadableStream的读取循环
      while (true) {
        const { done, value } = await reader.read(); // 从stream中读取数据
        if (done) {
          // 如果到达流的末尾，关闭Node的流
          nodeReadable.push(null);
          break;
        }
        // 将数据块推送到Node的流中
        nodeReadable.push(Buffer.from(value));
      }
    } catch (err) {
      // 如果发生错误，关闭流
      nodeReadable.destroy(err);
    }
  })();

  // 返回转换后的Node.js的Readable流
  return nodeReadable;
}

function splitStringRandomly(str: string) {
  // 用于存储切分后的字符串片段
  let result: string[] = [];

  // 当前还未处理的字符串部分的起始位置
  let startPos = 0;

  // 遍历字符串，决定每个片段的长度
  while (startPos < str.length) {
    // 确定下一个片段的长度，至少为1，最大不超过剩余字符串的长度
    let pieceLength = Math.floor(Math.random() * (str.length - startPos)) + 1;

    // 根据计算出的长度切分字符串，并将片段添加到结果数组
    let piece = str.substr(startPos, pieceLength);
    result.push(piece);

    // 更新起始位置，准备处理下一个片段
    startPos += pieceLength;
  }

  // 返回切分后的字符串数组
  return result;
}
