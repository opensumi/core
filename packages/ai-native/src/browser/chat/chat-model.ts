import { Injectable } from '@opensumi/di';
import {
  Disposable,
  Emitter,
  IChatAsyncContent,
  IChatComponent,
  IChatMarkdownContent,
  IChatProgress,
  IChatToolContent,
  IChatTreeData,
  uuid,
} from '@opensumi/ide-core-common';
import { MarkdownString, isMarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import {
  CoreMessage,
  IChatFollowup,
  IChatModel,
  IChatRequestMessage,
  IChatRequestModel,
  IChatResponseErrorDetails,
  IChatWelcomeMessageContent,
  ISampleQuestions,
  SLASH_SYMBOL,
} from '../../common';
import { MsgHistoryManager } from '../model/msg-history-manager';
import { IChatSlashCommandItem } from '../types';

import type { TextPart, ToolCallPart } from 'ai';

export type IChatProgressResponseContent =
  | IChatMarkdownContent
  | IChatAsyncContent
  | IChatTreeData
  | IChatComponent
  | IChatToolContent;

export class ChatResponseModel extends Disposable {
  #responseParts: IChatProgressResponseContent[] = [];
  get responseParts() {
    return this.#responseParts;
  }

  #responseContents: IChatProgressResponseContent[] = [];
  get responseContents() {
    return this.#responseContents;
  }

  #isComplete = false;
  get isComplete() {
    return this.#isComplete;
  }

  #isCanceled = false;
  get isCanceled() {
    return this.#isCanceled;
  }

  #requestId: string;
  get requestId(): string {
    return this.#requestId;
  }

  #responseText = '';
  get responseText() {
    return this.#responseText;
  }

  #errorDetails: IChatResponseErrorDetails | undefined;
  get errorDetails(): IChatResponseErrorDetails | undefined {
    return this.#errorDetails;
  }

  #followups: IChatFollowup[] | undefined;
  get followups(): IChatFollowup[] | undefined {
    return this.#followups;
  }

  #onDidChange = this.registerDispose(new Emitter<void>());
  get onDidChange() {
    return this.#onDidChange.event;
  }

  constructor(
    requestId: string,
    public readonly session: IChatModel,
    public readonly agentId: string,
    initParams?: {
      isComplete: boolean;
      isCanceled: boolean;
      responseContents: IChatProgressResponseContent[];
      responseParts: IChatProgressResponseContent[];
      responseText: string;
      errorDetails: IChatResponseErrorDetails | undefined;
      followups: IChatFollowup[] | undefined;
    },
  ) {
    super();
    this.#requestId = requestId;
    if (initParams) {
      this.#responseContents = initParams.responseContents;
      this.#responseParts = initParams.responseParts || [];
      this.#responseText = initParams.responseText;
      this.#isComplete = initParams.isComplete;
      this.#isCanceled = initParams.isCanceled;
      this.#errorDetails = initParams.errorDetails;
      this.#followups = initParams.followups;
    }
  }

  updateContent(progress: IChatProgress, quiet?: boolean): void {
    const responsePartLength = this.#responseParts.length - 1;
    if (progress.kind === 'content' || progress.kind === 'markdownContent') {
      const lastResponsePart = this.#responseParts[responsePartLength];

      if (!lastResponsePart || lastResponsePart.kind !== 'markdownContent') {
        if (progress.kind === 'content') {
          this.#responseParts.push({ content: new MarkdownString(progress.content), kind: 'markdownContent' });
        } else {
          this.#responseParts.push(progress);
        }
      } else if (progress.kind === 'markdownContent') {
        this.#responseParts[responsePartLength] = {
          content: new MarkdownString(lastResponsePart.content.value + progress.content.value),
          kind: 'markdownContent',
        };
      } else {
        this.#responseParts[responsePartLength] = {
          content: new MarkdownString(lastResponsePart.content.value + progress.content, lastResponsePart.content),
          kind: 'markdownContent',
        };
      }

      this.#updateResponseText();
    } else if (progress.kind === 'asyncContent') {
      // Add a new resolving part
      const responsePosition = this.#responseParts.push(progress) - 1;
      this.#updateResponseText();

      progress.resolvedContent?.then((content) => {
        // Replace the resolving part's content with the resolved response
        if (typeof content === 'string') {
          this.#responseParts[responsePosition] = { content: new MarkdownString(content), kind: 'markdownContent' };
        } else if (isMarkdownString(content)) {
          this.#responseParts[responsePosition] = { content, kind: 'markdownContent' };
        } else {
          this.#responseParts[responsePosition] = content;
        }
        this.#updateResponseText(quiet);
      });
    } else if (progress.kind === 'treeData' || progress.kind === 'component') {
      this.#responseParts.push(progress);
      this.#updateResponseText(quiet);
    } else if (progress.kind === 'toolCall') {
      const find = this.#responseParts.find(
        (item) => item.kind === 'toolCall' && item.content.id === progress.content.id,
      );
      if (find) {
        // @ts-ignore
        find.content = progress.content;
        // this.#responseParts[responsePartLength] = find;
      } else {
        this.#responseParts.push(progress);
      }
      this.#updateResponseText(quiet);
    }
  }

  #updateResponseText(quiet?: boolean) {
    this.#responseText = this.#responseParts
      .map((part) => {
        if (part.kind === 'asyncContent') {
          return part.content;
        }
        if (part.kind === 'treeData') {
          return '';
        }
        if (part.kind === 'component') {
          return '';
        }
        if (part.kind === 'toolCall') {
          return part.content.function.name;
        }
        return part.content.value;
      })
      .join('\n\n');

    // 合并连续的 markdown 内容
    const result: IChatProgressResponseContent[] = [];
    for (const item of this.#responseParts) {
      const previousItem = result[result.length - 1];
      if (item.kind === 'markdownContent' && previousItem?.kind === 'markdownContent') {
        result[result.length - 1] = {
          content: new MarkdownString(previousItem.content.value + item.content.value, {
            isTrusted: previousItem.content.isTrusted,
          }),
          kind: 'markdownContent',
        };
      } else {
        result.push(item);
      }
    }
    this.#responseContents = result;

    if (!quiet) {
      this.#onDidChange.fire();
    }
  }

  complete(): void {
    this.#isComplete = true;
    this.#onDidChange.fire();
  }

  cancel(): void {
    this.#isComplete = true;
    this.#isCanceled = true;
    this.#onDidChange.fire();
  }

  reset() {
    this.#responseContents = [];
    this.#responseParts = [];
    this.#responseText = '';
    this.#isCanceled = false;
    this.#isComplete = false;
    this.#errorDetails = undefined;
    this.#followups = undefined;
    this.#onDidChange.fire();
  }

  setErrorDetails(errorDetails: IChatResponseErrorDetails): void {
    this.#errorDetails = errorDetails;
    this.#onDidChange.fire();
  }

  setFollowups(followups: IChatFollowup[]): void {
    this.#followups = followups;
    this.#onDidChange.fire();
  }

  toJSON() {
    return {
      isCanceled: this.isCanceled,
      responseContents: this.responseContents,
      responseText: this.responseText,
      responseParts: this.responseParts,
      errorDetails: this.errorDetails,
      followups: this.followups,
    };
  }
}

export class ChatRequestModel implements IChatRequestModel {
  #requestId: string;
  public get requestId(): string {
    return this.#requestId;
  }

  constructor(
    requestId: string,
    public readonly session: IChatModel,
    public readonly message: IChatRequestMessage,
    public readonly response: ChatResponseModel,
  ) {
    this.#requestId = requestId;
  }

  toJSON() {
    return {
      requestId: this.requestId,
      message: this.message,
      response: this.response,
    };
  }
}

export class ChatModel extends Disposable implements IChatModel {
  private static requestIdPool = 0;

  constructor(initParams?: { sessionId?: string; history?: MsgHistoryManager; requests?: ChatRequestModel[] }) {
    super();
    this.#sessionId = initParams?.sessionId ?? uuid();
    this.history = initParams?.history ?? new MsgHistoryManager();
    if (initParams?.requests) {
      this.#requests = new Map(initParams.requests.map((r) => [r.requestId, r]));
    }
  }

  #sessionId: string;
  get sessionId(): string {
    return this.#sessionId;
  }

  #requests: Map<string, ChatRequestModel> = new Map();
  get requests(): ChatRequestModel[] {
    return Array.from(this.#requests.values());
  }

  restoreRequests(requests: ChatRequestModel[]): void {
    this.#requests = new Map(requests.map((r) => [r.requestId, r]));
  }

  readonly history: MsgHistoryManager;

  get messageHistory() {
    const history: CoreMessage[] = [];
    for (const request of this.requests) {
      if (!request.response.isComplete) {
        continue;
      }
      history.push({ role: 'user', content: request.message.prompt });
      for (const part of request.response.responseParts) {
        if (part.kind === 'treeData' || part.kind === 'component') {
          continue;
        }
        if (part.kind !== 'toolCall') {
          history.push({
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: part.kind === 'markdownContent' ? part.content.value : part.content,
              },
            ],
          });
        } else {
          // 直接开始toolCall场景
          if (history[history.length - 1].role !== 'assistant') {
            history.push({
              role: 'assistant',
              content: [],
            });
          }
          (history[history.length - 1].content as Array<TextPart | ToolCallPart>).push({
            type: 'tool-call',
            toolCallId: part.content.id,
            toolName: part.content.function.name,
            args: JSON.parse(part.content.function.arguments || '{}'),
          });
          history.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: part.content.id,
                toolName: part.content.function.name,
                result: JSON.parse(part.content.result || '{}'),
              },
            ],
          });
        }
      }
    }
    return history;
  }

  addRequest(message: IChatRequestMessage): ChatRequestModel {
    const msg = message;

    const requestId = `${this.sessionId}_request_${ChatModel.requestIdPool++}`;
    const response = new ChatResponseModel(requestId, this, msg.agentId);
    const request = new ChatRequestModel(requestId, this, msg, response);

    this.#requests.set(requestId, request);
    return request;
  }

  acceptResponseProgress(request: ChatRequestModel, progress: IChatProgress, quiet?: boolean): void {
    if (request.response.isComplete) {
      throw new Error('acceptResponseProgress: Adding progress to a completed response');
    }

    const { kind } = progress;

    const basicKind = ['content', 'markdownContent', 'asyncContent', 'treeData', 'component', 'toolCall'];

    if (basicKind.includes(kind)) {
      request.response.updateContent(progress, quiet);
    } else {
      // eslint-disable-next-line no-console
      console.error(`Couldn't handle progress: ${JSON.stringify(progress)}`);
    }
  }

  getRequest(requestId: string): ChatRequestModel | undefined {
    return this.#requests.get(requestId);
  }

  override dispose(): void {
    super.dispose();
    this.#requests.forEach((r) => r.response.dispose());
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      history: this.history,
      requests: this.requests,
    };
  }
}

@Injectable({ multiple: true })
export class ChatWelcomeMessageModel extends Disposable {
  private static nextId = 0;

  private _id: string;
  public get id(): string {
    return this._id;
  }

  constructor(
    public readonly content: IChatWelcomeMessageContent,
    public readonly sampleQuestions: ISampleQuestions[],
  ) {
    super();

    this._id = 'welcome_' + ChatWelcomeMessageModel.nextId++;
  }
}

@Injectable({ multiple: true })
export class ChatSlashCommandItemModel extends Disposable implements IChatSlashCommandItem {
  constructor(
    private readonly chatCommand: IChatSlashCommandItem,
    public readonly command?: string,
    public readonly agentId?: string,
  ) {
    super();
  }

  get name() {
    return this.chatCommand.name;
  }

  get isShortcut() {
    return !!this.chatCommand.isShortcut;
  }

  get icon() {
    return this.chatCommand.icon;
  }

  get description() {
    return this.chatCommand.description;
  }

  get tooltip() {
    return this.chatCommand.tooltip;
  }

  get nameWithSlash() {
    return this.name.startsWith(SLASH_SYMBOL) ? this.name : `${SLASH_SYMBOL} ${this.name}`;
  }
}
