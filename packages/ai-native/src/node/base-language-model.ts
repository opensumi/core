import { CoreMessage, ImagePart, TextPart, ToolExecutionOptions, jsonSchema, streamText, tool } from 'ai';

import { Autowired, Injectable } from '@opensumi/di';
import { IAIBackServiceOption } from '@opensumi/ide-core-common';
import { ChatReadableStream, INodeLogger } from '@opensumi/ide-core-node';
import { CancellationToken } from '@opensumi/ide-utils';

import { ModelInfo } from '../common';
import {
  IToolInvocationRegistryManager,
  ToolInvocationRegistryManager,
  ToolRequest,
} from '../common/tool-invocation-registry';

@Injectable()
export abstract class BaseLanguageModel {
  static ModelOptions: Record<string, ModelInfo>;

  @Autowired(ToolInvocationRegistryManager)
  protected readonly toolInvocationRegistryManager: IToolInvocationRegistryManager;

  @Autowired(INodeLogger)
  protected readonly logger: INodeLogger;

  protected abstract initializeProvider(options: IAIBackServiceOption): any;

  async request(
    request: string,
    chatReadableStream: ChatReadableStream,
    options: IAIBackServiceOption,
    cancellationToken?: CancellationToken,
  ): Promise<any> {
    const provider = this.initializeProvider(options);
    const clientId = options.clientId;

    let allFunctions: ToolRequest[] = [];
    // 如果没有传入 clientId，则不使用工具
    if (clientId) {
      const registry = this.toolInvocationRegistryManager.getRegistry(clientId);
      allFunctions = options.noTool ? [] : registry.getAllFunctions();

      // 过滤禁用的工具
      if (options.disabledTools && options.disabledTools.length > 0) {
        const disabledToolsSet = new Set(options.disabledTools);
        allFunctions = allFunctions.filter((tool) => !disabledToolsSet.has(tool.name));
      }
    }

    return this.handleStreamingRequest(
      provider,
      request,
      allFunctions,
      chatReadableStream,
      options.history || [],
      options.modelId,
      options.providerOptions,
      options.trimTexts,
      options.system,
      options.maxTokens,
      options.images,
      cancellationToken,
    );
  }

  private convertToolRequestToAITool(toolRequest: ToolRequest) {
    return tool({
      description: toolRequest.description || '',
      // TODO 这里应该是 z.object 而不是 JSON Schema
      parameters: jsonSchema(toolRequest.parameters),
      execute: async (args: any, options: ToolExecutionOptions) => {
        // 执行原始工具
        const result = await toolRequest.handler(JSON.stringify(args), options);
        return result;
      },
    });
  }

  protected abstract getModelIdentifier(provider: any, modelId?: string): any;

  protected abstract getModelInfo(modelId: string, providerOptions?: Record<string, any>): ModelInfo | undefined;

  protected async handleStreamingRequest(
    provider: any,
    request: string,
    tools: ToolRequest[],
    chatReadableStream: ChatReadableStream,
    history: CoreMessage[] = [],
    modelId?: string,
    providerOptions?: Record<string, any>,
    trimTexts?: [string, string],
    systemPrompt?: string,
    maxTokens?: number,
    images?: string[],
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
        ...history,
        {
          role: 'user',
          content: images?.length
            ? [
                { type: 'text', text: request } as TextPart,
                ...images.map((image) => ({ type: 'image', image: new URL(image) } as ImagePart)),
              ]
            : request,
        },
      ];
      const modelInfo = modelId ? this.getModelInfo(modelId, providerOptions) : undefined;
      const stream = streamText({
        model: this.getModelIdentifier(provider, modelId),
        tools: aiTools,
        messages,
        abortSignal: abortController.signal,
        experimental_toolCallStreaming: true,
        maxSteps: modelInfo?.maxSteps ?? 25,
        maxTokens,
        system: systemPrompt,
        providerOptions,
        ...(modelInfo?.temperature !== undefined && { temperature: modelInfo.temperature }),
        ...(modelInfo?.topP !== undefined && { topP: modelInfo.topP }),
        ...(modelInfo?.topK !== undefined && { topK: modelInfo.topK }),
      });

      // 状态跟踪变量
      let isFirstChunk = true;
      let bufferedText = '';
      const pendingLines: string[] = [];
      // 跟踪正在进行的工具调用状态
      const ongoingToolCalls = new Map<string, { name: string; args?: string }>();
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          if (trimTexts?.length) {
            // 将收到的文本追加到缓冲区
            bufferedText += chunk.textDelta;

            // 处理第一个文本块的前缀（只处理一次）
            if (isFirstChunk && bufferedText.includes(trimTexts[0])) {
              bufferedText = bufferedText.substring(bufferedText.indexOf(trimTexts[0]) + trimTexts[0].length);
              isFirstChunk = false;
            }

            // 检查是否有完整的行，并将它们添加到待发送行队列
            const lines = bufferedText.split('\n');

            // 最后一个元素可能是不完整的行，保留在缓冲区
            bufferedText = lines.pop() || '';

            // 将完整的行添加到待发送队列
            if (lines.length > 0) {
              pendingLines.push(...lines);
            }

            // 发送除最后几行外的所有行（保留足够的行以处理后缀）
            while (pendingLines.length > 3) {
              // 保留最后3行以确保能完整识别后缀
              const lineToSend = pendingLines.shift() + '\n';
              chatReadableStream.emitData({ kind: 'content', content: lineToSend });
            }
          } else {
            chatReadableStream.emitData({ kind: 'content', content: chunk.textDelta });
          }
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
          // 记录开始的工具调用
          ongoingToolCalls.set(chunk.toolCallId, { name: chunk.toolName });
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
          // 更新工具调用状态
          const existing = ongoingToolCalls.get(chunk.toolCallId);
          if (existing) {
            existing.args = (existing.args || '') + chunk.argsTextDelta;
          }
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
          // 移除已完成的工具调用
          ongoingToolCalls.delete(chunk.toolCallId);
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
        } else if (chunk.type === 'reasoning') {
          chatReadableStream.emitData({
            kind: 'reasoning',
            content: chunk.textDelta,
          });
        }
      }

      // 处理未完成的工具调用 - 将它们标记为完成状态
      for (const [toolCallId, toolCall] of ongoingToolCalls) {
        try {
          chatReadableStream.emitData({
            kind: 'toolCall',
            content: {
              id: toolCallId,
              type: 'function',
              function: {
                name: toolCall.name,
                arguments: toolCall.args || '{}',
              },
              state: 'complete',
            },
          });
        } catch (error) {
          // 记录错误但不阻止流的结束
          this.logger?.error(`Failed to finalize tool call ${toolCallId}:`, error);
        }
      }
      // 清空正在进行的工具调用
      ongoingToolCalls.clear();

      if (trimTexts?.[1]) {
        // 完成处理所有块后，检查并发送剩余文本

        // 将剩余缓冲区加入待发送行
        if (bufferedText) {
          pendingLines.push(bufferedText);
        }

        // 处理最后一行可能存在的后缀
        if (pendingLines.length > 0) {
          let lastLine = pendingLines[pendingLines.length - 1].trim();

          if (lastLine.endsWith(trimTexts[1])) {
            // 移除后缀
            lastLine = lastLine.substring(0, lastLine.length - trimTexts[1].length);
            pendingLines[pendingLines.length - 1] = lastLine;
          }
        }

        // 发送所有剩余的行
        for (let i = 0; i < pendingLines.length; i++) {
          const isLastLine = i === pendingLines.length - 1;
          const lineToSend = pendingLines[i] + (isLastLine ? '' : '\n');
          chatReadableStream.emitData({ kind: 'content', content: lineToSend });
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
