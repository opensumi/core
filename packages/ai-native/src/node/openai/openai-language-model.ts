import OpenAI from 'openai';
import { RunnableToolFunctionWithoutParse } from 'openai/lib/RunnableFunction';

import { Autowired, Injectable } from '@opensumi/di';
import { ChatReadableStream } from '@opensumi/ide-core-node';
import { CancellationToken } from '@opensumi/ide-utils';

import { ToolInvocationRegistry, ToolInvocationRegistryImpl, ToolRequest } from '../../common/tool-invocation-registry';

export const OpenAiModelIdentifier = Symbol('OpenAiModelIdentifier');

const apiKey = '';

// 暂不需要，后面的大模型尽量通过 vercel ai sdk 来接入
@Injectable()
export class OpenAIModel {
  @Autowired(ToolInvocationRegistry)
  private readonly toolInvocationRegistry: ToolInvocationRegistryImpl;

  protected initializeOpenAi(): OpenAI {
    if (!apiKey) {
      throw new Error('Please provide ANTHROPIC_API_KEY in preferences or via environment variable');
    }

    return new OpenAI({ apiKey: apiKey ?? 'no-key', baseURL: 'https://api.deepseek.com' });
  }

  async request(request: string, cancellationToken?: CancellationToken): Promise<any> {
    return this.handleStreamingRequest(request, cancellationToken);
  }

  private createTool(tools: ToolRequest[]): RunnableToolFunctionWithoutParse[] {
    return tools?.map(
      (tool) =>
        ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            function: (args_string: string) => tool.handler(args_string),
          },
        } as RunnableToolFunctionWithoutParse),
    );
  }

  private getCompletionContent(message: OpenAI.Chat.Completions.ChatCompletionToolMessageParam): string {
    if (Array.isArray(message.content)) {
      return message.content.join('');
    }
    return message.content;
  }

  protected async handleStreamingRequest(request: string, cancellationToken?: CancellationToken): Promise<any> {
    const chatReadableStream = new ChatReadableStream();

    const openai = this.initializeOpenAi();

    const allFunctions = this.toolInvocationRegistry.getAllFunctions();

    const tools = this.createTool(allFunctions);

    const params = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: request }],
      stream: true,
      tools,
      tool_choice: 'auto',
    } as any;
    console.log('🚀 ~ OpenAIModel ~ params:', JSON.stringify(params, null, 2));

    const runner = openai.beta.chat.completions.runTools(params) as any;

    cancellationToken?.onCancellationRequested(() => {
      runner.abort();
    });

    const runnerEnd = false;

    // runner.on('error', error => {
    //   console.error('Error in OpenAI chat completion stream:', error);
    //   runnerEnd = true;
    //   resolve({ content: error.message });
    // });
    // // we need to also listen for the emitted errors, as otherwise any error actually thrown by the API will not be caught
    // runner.emitted('error').then(error => {
    //   console.error('Error in OpenAI chat completion stream:', error);
    //   runnerEnd = true;
    //   resolve({ content: error.message });
    // });
    // runner.emitted('abort').then(() => {
    //   // do nothing, as the abort event is only emitted when the runner is aborted by us
    // });
    // runner.on('message', message => {
    //   if (message.tool_calls) {
    //     resolve({
    //       tool_calls: message.tool_calls.map((tool) => (
    //         {
    //           id: tool.id,
    //           type: tool.type,
    //           function: tool.function
    //         }
    //       ))
    //     });
    //   }
    // });
    runner.once('end', () => {
      // runnerEnd = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // resolve(runner.finalChatCompletion as any);
      chatReadableStream.end();
    });

    runner.on('chunk', (chunk) => {
      if (chunk.choices[0]?.delta) {
        const chunkData = { ...chunk.choices[0]?.delta };
        // resolve(chunkData);

        console.log('🚀 ~ OpenAIModel ~ chunkData:', chunkData);
        if (chunkData.tool_calls) {
          chatReadableStream.emitData({ kind: 'toolCall', content: chunkData.tool_calls[0] });
        } else if (chunkData.content) {
          chatReadableStream.emitData({ kind: 'content', content: chunkData.content });
        }
      }
    });

    // const asyncIterator = {
    //   async *[Symbol.asyncIterator](): AsyncIterator<any> {
    //     runner.on('chunk', chunk => {
    //       if (chunk.choices[0]?.delta) {
    //         const chunkData = { ...chunk.choices[0]?.delta };
    //         resolve(chunkData);

    //         if (chunkData.tool_calls) {
    //           chatReadableStream.emitData({ kind: 'toolCall', content: chunkData.tool_calls[0] });
    //         } else if (chunkData.content) {
    //           chatReadableStream.emitData({ kind: 'content', content: chunkData.content });
    //         }
    //       }
    //     });
    //     while (!runnerEnd) {
    //       const promise = new Promise<any>((res, rej) => {
    //         resolve = res;
    //       });
    //       yield promise;
    //     }
    //   }
    // };
    // return { stream: asyncIterator };
    return chatReadableStream;
  }
}
