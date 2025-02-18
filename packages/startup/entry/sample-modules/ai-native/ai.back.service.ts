import { Autowired, Injectable } from '@opensumi/di';
import { AnthropicModel } from '@opensumi/ide-ai-native/lib/node/anthropic/anthropic-language-model';
import { DeepSeekModel } from '@opensumi/ide-ai-native/lib/node/deepseek/deepseek-language-model';
import { OpenAIModel } from '@opensumi/ide-ai-native/lib/node/openai/openai-language-model';
import { IAIBackServiceOption } from '@opensumi/ide-core-common';
import {
  CancellationToken,
  ChatReadableStream,
  IAIBackService,
  IAIBackServiceResponse,
  INodeLogger,
  sleep,
} from '@opensumi/ide-core-node';

export interface ReqeustResponse extends IAIBackServiceResponse {
  responseText?: string;
  urlMessage?: string;
  data: string;
}

// 模拟 stream 数据,包含一段 TypeScript 代码
const streamData = [
  'Here is a simple TypeScript code ',
  'snippet: \n```typescript\ne',
  'xport class Person {\n',
  '  name: string;\n',
  '  age: number;\n',
  '}\n',
  '\n',
  'const person: Person = {\n',
  '  name: "John Doe",\n',
  '  age: 30\n',
  '};\n',
  '\n',
  'function greet(person: Person) {\n  console.log(`Hello, ${person.name}!`);\n  // #Command#:',
  ' du -sh *\n',
  '  // #Description#: 查看当前文件夹下所有文件和子文件夹的大小\n',
  '}\n',
  '\n',
  'greet(person); // Output: "Hello, John Doe!"\n',
  '```\n',
  'This code defines a Person interface and creates an object that implements it.',
  'It then defines a function that takes a Person object and logs a greeting.',
  'Make sure to handle the stream data properly in your application.',
];

@Injectable()
export class AIBackService implements IAIBackService<ReqeustResponse, ChatReadableStream> {
  @Autowired(INodeLogger)
  protected readonly logger: INodeLogger;

  @Autowired(AnthropicModel)
  protected readonly anthropicModel: AnthropicModel;

  @Autowired(OpenAIModel)
  protected readonly openaiModel: OpenAIModel;

  @Autowired(DeepSeekModel)
  protected readonly deepseekModel: DeepSeekModel;

  async request(input: string, options: IAIBackServiceOption, cancelToken?: CancellationToken) {
    await sleep(1000);

    if (options.type === 'rename') {
      return Promise.resolve({
        errorCode: 0,
        data: '```typescript\nnewName\nhaha```',
      });
    }

    return Promise.resolve({
      errorCode: 0,
      data: streamData.join(''),
    });
  }

  async requestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<ChatReadableStream> {
    const chatReadableStream = new ChatReadableStream();

    cancelToken?.onCancellationRequested(() => {
      chatReadableStream.abort();
    });

    const model = options.model;

    if (model === 'openai') {
      this.openaiModel.request(input, chatReadableStream, options, cancelToken);
    } else if (model === 'deepseek') {
      this.deepseekModel.request(input, chatReadableStream, options, cancelToken);
    } else {
      this.anthropicModel.request(input, chatReadableStream, options, cancelToken);
    }

    return chatReadableStream;
  }
}
