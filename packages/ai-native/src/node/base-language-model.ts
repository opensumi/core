import { CoreMessage, jsonSchema, streamText, tool } from 'ai';

import { Autowired, Injectable } from '@opensumi/di';
import { ChatMessageRole, IAIBackServiceOption, IChatMessage } from '@opensumi/ide-core-common';
import { ChatReadableStream } from '@opensumi/ide-core-node';
import { CancellationToken } from '@opensumi/ide-utils';

import {
  IToolInvocationRegistryManager,
  ToolInvocationRegistryManager,
  ToolRequest,
} from '../common/tool-invocation-registry';

@Injectable()
export abstract class BaseLanguageModel {
  @Autowired(ToolInvocationRegistryManager)
  protected readonly toolInvocationRegistryManager: IToolInvocationRegistryManager;

  protected abstract initializeProvider(options: IAIBackServiceOption): any;

  private convertChatMessageRole(role: ChatMessageRole) {
    switch (role) {
      case ChatMessageRole.System:
        return 'system';
      case ChatMessageRole.User:
        return 'user';
      case ChatMessageRole.Assistant:
        return 'assistant';
      case ChatMessageRole.Function:
        return 'tool';
      default:
        return 'user';
    }
  }

  async request(
    request: string,
    chatReadableStream: ChatReadableStream,
    options: IAIBackServiceOption,
    cancellationToken?: CancellationToken,
  ): Promise<any> {
    const provider = this.initializeProvider(options);
    const clientId = options.clientId;
    if (!clientId) {
      throw new Error('clientId is required');
    }
    const registry = this.toolInvocationRegistryManager.getRegistry(clientId);
    const allFunctions = registry.getAllFunctions();
    return this.handleStreamingRequest(
      provider,
      request,
      allFunctions,
      chatReadableStream,
      options.history || [],
      cancellationToken,
    );
  }

  private convertToolRequestToAITool(toolRequest: ToolRequest) {
    return tool({
      description: toolRequest.description || '',
      // TODO 这里应该是 z.object 而不是 JSON Schema
      parameters: jsonSchema(toolRequest.parameters),
      execute: async (args: any) => await toolRequest.handler(JSON.stringify(args)),
    });
  }

  protected abstract getModelIdentifier(provider: any): any;

  protected async handleStreamingRequest(
    provider: any,
    request: string,
    tools: ToolRequest[],
    chatReadableStream: ChatReadableStream,
    history: IChatMessage[] = [],
    cancellationToken?: CancellationToken,
  ): Promise<any> {
    try {
      const aiTools = Object.fromEntries(tools.map((tool) => [tool.name, this.convertToolRequestToAITool(tool)]));

      const abortController = new AbortController();
      if (cancellationToken) {
        cancellationToken.onCancellationRequested(() => {
          abortController.abort();
        });
      }

      const messages: CoreMessage[] = [
        ...history.map((msg) => ({
          role: this.convertChatMessageRole(msg.role) as any, // 这个 SDK 包里的类型不太好完全对应，
          content: msg.content,
        })),
        { role: 'user', content: request },
      ];

      const stream = await streamText({
        model: this.getModelIdentifier(provider),
        maxTokens: 4096,
        tools: aiTools,
        messages,
        abortSignal: abortController.signal,
        experimental_toolCallStreaming: true,
        maxSteps: 12,
      });

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          chatReadableStream.emitData({ kind: 'content', content: chunk.textDelta });
        } else if (chunk.type === 'tool-call') {
          chatReadableStream.emitData({
            kind: 'toolCall',
            content: {
              id: chunk.toolCallId || Date.now().toString(),
              type: 'function',
              function: { name: chunk.toolName, arguments: JSON.stringify(chunk.args) },
              state: 'complete',
            },
          });
        } else if (chunk.type === 'tool-call-streaming-start') {
          chatReadableStream.emitData({
            kind: 'toolCall',
            content: {
              id: chunk.toolCallId,
              type: 'function',
              function: { name: chunk.toolName },
              state: 'streaming-start',
            },
          });
        } else if (chunk.type === 'tool-call-delta') {
          chatReadableStream.emitData({
            kind: 'toolCall',
            content: {
              id: chunk.toolCallId,
              type: 'function',
              function: { name: chunk.toolName, arguments: chunk.argsTextDelta },
              state: 'streaming',
            },
          });
        } else if (chunk.type === 'tool-result') {
          chatReadableStream.emitData({
            kind: 'toolCall',
            content: {
              id: chunk.toolCallId,
              type: 'function',
              function: { name: chunk.toolName, arguments: JSON.stringify(chunk.args) },
              result: chunk.result,
              state: 'result',
            },
          });
        } else if (chunk.type === 'error') {
          chatReadableStream.emitError(new Error(chunk.error as string));
        }
      }

      chatReadableStream.end();
    } catch (error) {
      // Use a logger service in production instead of console
      chatReadableStream.emitError(error);
    }

    return chatReadableStream;
  }
}
