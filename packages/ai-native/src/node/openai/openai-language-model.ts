import { CancellationToken } from '@opensumi/ide-utils';
import OpenAI from 'openai';
import { ChatCompletionStream } from 'openai/lib/ChatCompletionStream';
import { RunnableToolFunctionWithoutParse } from 'openai/lib/RunnableFunction';
import { ToolRequest } from '../../common/tool-invocation-registry';

export const OpenAiModelIdentifier = Symbol('OpenAiModelIdentifier');

const apiKey = '';

export class OpenAIModel {
  protected initializeOpenAi(): OpenAI {
    if (!apiKey) {
      throw new Error('Please provide ANTHROPIC_API_KEY in preferences or via environment variable');
    }

    return new OpenAI({ apiKey: apiKey ?? 'no-key', baseURL: 'https://api.openai.com' });
  }

  async request(request: string, tools: ToolRequest[], cancellationToken?: CancellationToken): Promise<any> {
    return this.handleStreamingRequest(request, tools, cancellationToken);
    // return this.handleNonStreamingRequest(anthropic, request, tools);
  }

  private createTool(tools: ToolRequest[]): RunnableToolFunctionWithoutParse[] {
    return tools?.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        function: (args_string: string) => tool.handler(args_string)
      }
    } as RunnableToolFunctionWithoutParse));
  }

  private getCompletionContent(message: OpenAI.Chat.Completions.ChatCompletionToolMessageParam): string {
    if (Array.isArray(message.content)) {
      return message.content.join('');
    }
    return message.content;
  }

  protected async handleStreamingRequest(
    request: string,
    rawTools: ToolRequest[],
    cancellationToken?: CancellationToken
  ): Promise<any> {

    const openai = this.initializeOpenAi();

    const tools = this.createTool(rawTools);

    const params = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: request }],
      stream: true,
      tools: tools,
      tool_choice: 'auto',
    } as any;
    console.log("🚀 ~ OpenAIModel ~ params:", JSON.stringify(params, null, 2));

    const runner = openai.beta.chat.completions.runTools(params) as any;

    cancellationToken?.onCancellationRequested(() => {
      runner.abort();
    });

    let runnerEnd = false;

    let resolve: (part: any) => void;
    runner.on('error', error => {
      console.error('Error in OpenAI chat completion stream:', error);
      runnerEnd = true;
      resolve({ content: error.message });
    });
    // we need to also listen for the emitted errors, as otherwise any error actually thrown by the API will not be caught
    runner.emitted('error').then(error => {
      console.error('Error in OpenAI chat completion stream:', error);
      runnerEnd = true;
      resolve({ content: error.message });
    });
    runner.emitted('abort').then(() => {
      // do nothing, as the abort event is only emitted when the runner is aborted by us
    });
    runner.on('message', message => {
      if (message.role === 'tool') {
        resolve({ tool_calls: [{ id: message.tool_call_id, finished: true, result: this.getCompletionContent(message) }] });
      }
      console.debug('Received Open AI message', JSON.stringify(message));
    });
    runner.once('end', () => {
      runnerEnd = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve(runner.finalChatCompletion as any);
    });
    const asyncIterator = {
      async *[Symbol.asyncIterator](): AsyncIterator<any> {
        runner.on('chunk', chunk => {
          if (chunk.choices[0]?.delta) {
            resolve({ ...chunk.choices[0]?.delta });
          }
        });
        while (!runnerEnd) {
          const promise = new Promise<any>((res, rej) => {
            resolve = res;
          });
          yield promise;
        }
      }
    };
    return { stream: asyncIterator };
  }
}
