import { Disposable, Emitter, Event, uuid } from '@opensumi/ide-core-common';
import { ChatMessageRole, IHistoryChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

import { ChatFeatureRegistry } from '../chat/chat.feature.registry';

type IExcludeMessage = Omit<IHistoryChatMessage, 'id' | 'order'>;

interface IMemoryConfig {
  shortTermSize: number; // 最近消息窗口大小（10条）
  bufferSize: number; // 缓冲区大小（5条）
}

interface IMemorySummary {
  content: string;
  timestamp: number;
  messageIds: string[];
}

interface IToolCallInfo {
  id: string;
  name: string;
  args: Record<string, any>;
  result: any;
}

export interface MessageBufferManager {
  messages: IHistoryChatMessage[];
  add(message: IHistoryChatMessage): void;
  clear(): void;
  size(): number;
}

class SimpleMessageBuffer implements MessageBufferManager {
  private _messages: IHistoryChatMessage[] = [];

  get messages(): IHistoryChatMessage[] {
    return this._messages;
  }

  add(message: IHistoryChatMessage): void {
    this._messages.push(message);
  }

  clear(): void {
    this._messages = [];
  }

  size(): number {
    return this._messages.length;
  }
}

export class MsgHistoryManager extends Disposable {
  private messageMap: Map<string, IHistoryChatMessage> = new Map();
  private messageAdditionalMap: Map<string, Record<string, any>> = new Map();
  private memorySummaries: IMemorySummary[] = [];
  private toolCallMap: Map<string, IToolCallInfo> = new Map();
  private isCompressing = false; // 添加压缩锁，防止重复压缩

  private readonly _onMessageChange = new Emitter<IHistoryChatMessage[]>();
  public readonly onMessageChange: Event<IHistoryChatMessage[]> = this._onMessageChange.event;

  private readonly _onMessageAdditionalChange = new Emitter<Record<string, any>>();
  public readonly onMessageAdditionalChange: Event<Record<string, any>> = this._onMessageAdditionalChange.event;

  private messageBuffer: MessageBufferManager;

  memoryConfig: IMemoryConfig = {
    shortTermSize: 10,
    bufferSize: 5,
  };

  constructor(
    private chatFeatureRegistry: ChatFeatureRegistry,
    data?: {
      additional: Record<string, any>;
      messages: IHistoryChatMessage[];
      toolCalls?: Record<string, IToolCallInfo>;
      memorySummaries?: IMemorySummary[];
    },
  ) {
    super();
    this.messageBuffer = new SimpleMessageBuffer();
    if (data) {
      this.messageMap = new Map(data.messages.map((item) => [item.id, item]));
      this.messageAdditionalMap = new Map(Object.entries(data.additional));
      if (data.toolCalls) {
        this.toolCallMap = new Map(Object.entries(data.toolCalls));
      }
      if (data.memorySummaries) {
        this.memorySummaries = data.memorySummaries;
      }
    }
  }

  override dispose(): void {
    this.clearMessages();
    super.dispose();
  }

  public get size(): number {
    return this.messageMap.size;
  }

  public clearMessages() {
    this.messageMap.clear();
    this.messageAdditionalMap.clear();
    this.memorySummaries = [];
    this.toolCallMap.clear();
  }

  /**
   * 压缩历史消息的方法：
   * 1. 保持最新的10条消息不变
   * 2. 当累积了5条超出限制的消息时，对这5条（最早的消息）进行总结
   * 3. 总结完成后删除这5条消息
   * 4. 重复这个过程，确保消息数量始终在可控范围内
   */
  private async compressMemory() {
    // 如果正在压缩中，直接返回
    if (this.isCompressing) {
      return;
    }

    const messages = this.messageList;
    // 只有当消息总数超过短期记忆限制时才进行压缩
    if (messages.length <= this.memoryConfig.shortTermSize) {
      return;
    }

    try {
      this.isCompressing = true;

      // 1. 获取超出短期记忆限制的最新一条消息
      const latestExcessMessage = messages[messages.length - this.memoryConfig.shortTermSize - 1];

      // 如果这条消息已经被总结过，就不需要再处理
      if (latestExcessMessage.isSummarized) {
        return;
      }

      // 2. 将这条消息添加到缓冲区
      this.messageBuffer.add(latestExcessMessage);

      // 3. 当缓冲区达到指定大小时，进行总结
      if (this.messageBuffer.size() >= this.memoryConfig.bufferSize) {
        const messagesToSummarize = this.messageBuffer.messages;

        const summaryProvider = this.chatFeatureRegistry.getMessageSummaryProvider?.();
        if (summaryProvider) {
          const messageContents = messagesToSummarize.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

          const memorize = await summaryProvider.generateMemorizedMessage(messageContents);
          if (memorize) {
            // 添加新的记忆总结
            this.memorySummaries.push({
              content: memorize,
              timestamp: Date.now(),
              messageIds: messagesToSummarize.map((msg) => msg.id),
            });

            // 标记消息为已总结
            for (const msg of messagesToSummarize) {
              const existingMsg = this.messageMap.get(msg.id);
              if (existingMsg) {
                this.messageMap.set(msg.id, {
                  ...existingMsg,
                  isSummarized: true,
                });
              }
            }

            // 清空缓冲区
            this.messageBuffer.clear();
          }
        }
      }
    } finally {
      this.isCompressing = false;
    }
  }

  public addToolCall(toolCall: IToolCallInfo): void {
    this.toolCallMap.set(toolCall.id, toolCall);
  }

  public getToolCall(id: string): IToolCallInfo | undefined {
    const toolCall = this.toolCallMap.get(id);
    return toolCall;
  }

  private doAddMessage(message: IExcludeMessage): string {
    const id = uuid(6);
    const order = this.messageMap.size;

    const msg = {
      ...message,
      id,
      order,
      type: message.type || 'string',
    };

    this.messageMap.set(id, msg);

    // 在添加新消息后尝试压缩记忆
    this.compressMemory().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[MsgHistoryManager] Error compressing memory', error);
    });

    // 无论压缩是否完成，都触发消息变更事件
    this._onMessageChange.fire(this.getMessages());
    return id;
  }

  private get messageList(): IHistoryChatMessage[] {
    // 按 order 升序排序，保持消息的原始顺序
    return Array.from(this.messageMap.values()).sort((a, b) => a.order - b.order);
  }

  public get lastMessageId(): string | undefined {
    const list = this.messageList;
    return list[list.length - 1]?.id;
  }

  public getMessages(): IHistoryChatMessage[] {
    return this.messageList;
  }

  public getMemorySummaries(): IMemorySummary[] {
    return this.memorySummaries;
  }

  public setMemoryConfig(config: Partial<IMemoryConfig>) {
    this.memoryConfig = {
      ...this.memoryConfig,
      ...config,
    };
  }

  public addUserMessage(
    message: Required<Pick<IExcludeMessage, 'agentId' | 'agentCommand' | 'content' | 'relationId' | 'images'>>,
  ): string {
    return this.doAddMessage({
      ...message,
      role: ChatMessageRole.User,
    });
  }

  public addAssistantMessage(message: Omit<IExcludeMessage, 'role'>): string {
    return this.doAddMessage({
      ...message,
      role: ChatMessageRole.Assistant,
    });
  }

  public updateAssistantMessage(id: string, message: Omit<IExcludeMessage, 'role'>) {
    if (!this.messageMap.has(id)) {
      return;
    }

    const oldMessage = this.messageMap.get(id);

    this.messageMap.set(id, {
      ...oldMessage!,
      content: message.content,
    });
  }

  public setMessageAdditional(id: string, additional: Record<string, any>) {
    if (!this.messageMap.has(id)) {
      return;
    }

    const oldAdditional = this.messageAdditionalMap.get(id) || {};
    const newAdditional = {
      ...oldAdditional,
      ...additional,
    };

    this.messageAdditionalMap.set(id, newAdditional);
    this._onMessageAdditionalChange.fire(newAdditional);
  }

  public getMessageAdditional(id: string): Record<string, any> {
    return this.messageAdditionalMap.get(id) || {};
  }

  public get sessionAdditionals() {
    return this.messageAdditionalMap;
  }

  toJSON() {
    const data = {
      messages: this.getMessages(),
      additional: Object.fromEntries(this.messageAdditionalMap.entries()),
      memorySummaries: this.memorySummaries,
      toolCalls: Object.fromEntries(this.toolCallMap.entries()),
    };
    return data;
  }
}
