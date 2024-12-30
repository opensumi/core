import { Anthropic } from '@anthropic-ai/sdk';
import { MessageParam, Model, ToolChoiceAuto, MessageStream, Message } from '@anthropic-ai/sdk/resources/messages';
import { CancellationToken } from '@opensumi/ide-utils';
import { ToolRequest } from '../../common/tool-invocation-registry';

export const AnthropicModelIdentifier = Symbol('AnthropicModelIdentifier');

const apiKey = '';

export class AnthropicModel {
  protected initializeAnthropic(): Anthropic {
    if (!apiKey) {
      throw new Error('Please provide ANTHROPIC_API_KEY in preferences or via environment variable');
    }

    // return new Anthropic({ baseURL: 'https://api.gptsapi.net', apiKey: apiKey });
    return new Anthropic({ apiKey: apiKey, baseURL: 'https://api.runapi.sbs' });
  }

  async request(request: string, tools: ToolRequest[], cancellationToken?: CancellationToken): Promise<any> {
    const anthropic = this.initializeAnthropic();
    return this.handleStreamingRequest(anthropic, request, tools, cancellationToken);
    // return this.handleNonStreamingRequest(anthropic, request, tools);
  }

  private createTool(tools: ToolRequest[]): Anthropic.Messages.Tool[] {
    return tools.map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      } as Anthropic.Messages.Tool;
    });
  }

  protected async handleStreamingRequest(
    anthropic: Anthropic,
    request: string,
    tools: ToolRequest[],
    cancellationToken?: CancellationToken
  ): Promise<any> {
    const params: Anthropic.MessageCreateParams = {
      max_tokens: 2048, // Setting max_tokens is mandatory for Anthropic, settings can override this default
      stream: true,
      messages: [{ role: 'user', content: request }],
      model: 'claude-3-5-sonnet-20241022',
      tools: this.createTool(tools),
      tool_choice: {
        type: 'auto',
      }
    };

    const stream = anthropic.messages.stream(params);

    cancellationToken?.onCancellationRequested(() => {
      stream.abort();
    });

    const asyncIterator = {
      async *[Symbol.asyncIterator](): AsyncIterator<any> {
        try {
          for await (const event of stream) {
            console.log("🚀 ~ AnthropicModel ~ forawait ~ event:", event);
            if (event.type === 'content_block_start') {
              const contentBlock = event.content_block;

              if (contentBlock.type === 'text') {
                yield { content: contentBlock.text };
              }
            } else if (event.type === 'content_block_delta') {
              const delta = event.delta;

              if (delta.type === 'text_delta') {
                yield { content: delta.text };
              }
            }
          }
        } catch (error) {
          console.error('Error during async iteration:', error);
          throw error; // Re-throw the error to be handled by the caller
        }
      },
    };

    stream.on('error', (error: Error) => {
      console.error('Error in Anthropic streaming:', error);
    });

    return { stream: asyncIterator };
  }

  protected async handleNonStreamingRequest(
    anthropic: Anthropic,
    request: string,
    tools: ToolRequest[],
  ): Promise<Message> {

    const params: Anthropic.MessageCreateParams = {
      max_tokens: 2048,
      messages: [{ role: 'user', content: request }],
      model: 'claude-3-5-sonnet-20241022',
      tools: this.createTool(tools),
      tool_choice: {
        type: 'any',
      }
    };
    console.log("🚀 ~ AnthropicModel ~ params:", JSON.stringify(params, null, 2))

    const response: Anthropic.Message = await anthropic.messages.create(params);
    return response;
  }
}
