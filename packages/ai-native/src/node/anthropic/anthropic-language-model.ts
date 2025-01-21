import { Injectable, Autowired } from '@opensumi/di';
import { Anthropic } from '@anthropic-ai/sdk';
import { MessageParam, Model, ToolChoiceAuto, MessageStream, Message } from '@anthropic-ai/sdk/resources/messages';
import { CancellationToken } from '@opensumi/ide-utils';
import { ToolInvocationRegistry, ToolInvocationRegistryImpl, ToolRequest } from '../../common/tool-invocation-registry';
import { ChatReadableStream } from '@opensumi/ide-core-node';
import { z } from 'zod';
import { generateText, tool, streamText, jsonSchema } from 'ai';
import { anthropic, AnthropicProvider, createAnthropic } from '@ai-sdk/anthropic';

export const AnthropicModelIdentifier = Symbol('AnthropicModelIdentifier');

const apiKey = '';

@Injectable()
export class AnthropicModel {
  @Autowired(ToolInvocationRegistry)
  private readonly toolInvocationRegistry: ToolInvocationRegistryImpl;

  protected initializeAnthropicProvider() {
    if (!apiKey) {
      throw new Error('Please provide ANTHROPIC_API_KEY in preferences or via environment variable');
    }

    const anthropic = createAnthropic({ apiKey });

    return anthropic;
  }

  async request(request: string, chatReadableStream: ChatReadableStream, cancellationToken?: CancellationToken): Promise<any> {
    const anthropic = this.initializeAnthropicProvider();
    const allFunctions = this.toolInvocationRegistry.getAllFunctions();
    return this.handleStreamingRequest(anthropic, request, allFunctions, chatReadableStream, cancellationToken);
  }

  private convertToolRequestToAITool(toolRequest: ToolRequest) {
    return tool({
      // name: toolRequest.name,
      description: toolRequest.description || '',
      // TODO 这里应该是 z.object 而不是 JSON Schema
      parameters: jsonSchema(toolRequest.parameters),
      execute: async (args: any) => {
        return await toolRequest.handler(JSON.stringify(args));
      }
    });
  }

  protected async handleStreamingRequest(
    anthropic: AnthropicProvider,
    request: string,
    tools: ToolRequest[],
    chatReadableStream: ChatReadableStream,
    cancellationToken?: CancellationToken
  ): Promise<any> {
    
    try {
      const aiTools = Object.fromEntries(
        tools.map(tool => [tool.name, this.convertToolRequestToAITool(tool)])
      );

      const abortController = new AbortController();
      if (cancellationToken) {
        cancellationToken.onCancellationRequested(() => {
          abortController.abort();
        });
      }

      const stream = await streamText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        maxTokens: 4096,
        tools: aiTools,
        messages: [{ role: 'user', content: request }],
        abortSignal: abortController.signal,
        maxSteps: 5,
      });

      for await (const chunk of stream.fullStream) {
        console.log(chunk);
        if (chunk.type === 'text-delta') {
          chatReadableStream.emitData({ kind: 'content', content: chunk.textDelta });
        } else if (chunk.type === 'tool-call') {
          chatReadableStream.emitData({ kind: 'toolCall', content: { 
            id: chunk.toolCallId || Date.now().toString(),
            type: 'function',
            function: { name: chunk.toolName, arguments: JSON.stringify(chunk.args) }
          }});
        }
      }

      chatReadableStream.end();
    } catch (error) {
      console.error('Error during streaming:', error);
      chatReadableStream.emitError(error);
    }

    return chatReadableStream;
  }

}
