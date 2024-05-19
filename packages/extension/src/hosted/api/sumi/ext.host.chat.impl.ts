import {
  IChatAgentCommand,
  IChatAgentRequest,
  IChatAgentResult,
  IChatAgentWelcomeMessage,
  IChatFollowup,
  IChatReplyFollowup,
} from '@opensumi/ide-ai-native/lib/common';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { CancellationToken, Emitter, Progress, getDebugLogger, raceCancellation } from '@opensumi/ide-core-common';
import { IChatMessage, IChatProgress } from '@opensumi/ide-core-common/lib/types/ai-native';

import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import { IChatProgressChunk, IExtHostChatAgents, IMainThreadChatAgents } from '../../../common/sumi/chat-agents';
import { IExtensionDescription } from '../../../common/vscode';
import * as typeConverters from '../../../common/vscode/converter';

import type * as sumi from 'sumi';
import type * as vscode from 'vscode';

export class ExtHostChatAgents implements IExtHostChatAgents {
  private static idPool = 0;

  private proxy: IMainThreadChatAgents;
  private readonly agents = new Map<number, ExtHostChatAgent>();
  private readonly logger = getDebugLogger();

  private readonly previousResultMap: Map<string, vscode.ChatAgentResult2> = new Map();
  private readonly resultsBySessionAndRequestId: Map<string, Map<string, vscode.ChatAgentResult2>> = new Map();

  constructor(private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadChatAgents);
  }

  createChatAgent(extension: IExtensionDescription, name: string, handler: sumi.ChatAgentHandler) {
    const handle = ExtHostChatAgents.idPool++;
    const agent = new ExtHostChatAgent(extension, name, this.proxy, handle, handler);
    this.agents.set(handle, agent);
    this.proxy.$registerAgent(handle, name, {});
    return agent.apiAgent;
  }

  sendMessage(extension: IExtensionDescription, chunk: sumi.ChatAgentCustomReplyMessage) {
    let messagePayload: IChatProgress | undefined;

    if ('content' in chunk) {
      messagePayload =
        typeof chunk.content === 'string'
          ? { content: chunk.content, kind: 'content' }
          : { content: typeConverters.MarkdownString.from(chunk.content), kind: 'markdownContent' };
    }

    if ('component' in chunk) {
      messagePayload = {
        component: `${extension.identifier.value}:${chunk.component}`,
        value: chunk.value,
        kind: 'component',
      };
    }

    if (!messagePayload) {
      return;
    }

    this.proxy.$sendMessage(messagePayload);
  }

  async $invokeAgent(
    handle: number,
    request: IChatAgentRequest,
    context: { history: IChatMessage[] },
    token: CancellationToken,
  ): Promise<IChatAgentResult | undefined> {
    const { sessionId, requestId, command, message } = request;
    this.previousResultMap.delete(sessionId);

    const agent = this.agents.get(handle);
    if (!agent) {
      throw new Error(`[CHAT](${handle}) CANNOT invoke agent because the agent is not registered`);
    }

    let done = false;
    function throwIfDone() {
      if (done) {
        throw new Error('Only valid while executing the command');
      }
    }

    const slashCommand = command ? await agent.validateSlashCommand(command) : undefined;

    try {
      const task = agent.invoke(
        {
          prompt: message,
          variables: {}, // TODO: support # variables
          slashCommand,
        },
        { history: context.history.map(typeConverters.ChatMessage.to) },
        // 暂时只支持 { content: string } 格式的数据
        new Progress<sumi.ChatAgentProgress>((progress) => {
          throwIfDone();

          const convertedProgress = convertProgress(progress, agent.extension);
          if (!convertedProgress) {
            this.logger.error('Unknown progress type: ' + JSON.stringify(progress));
            return;
          }

          if ('placeholder' in progress && 'resolvedContent' in progress) {
            const resolvedContent = Promise.all([
              this.proxy.$handleProgressChunk(requestId, convertedProgress),
              progress.resolvedContent,
            ]);
            raceCancellation(resolvedContent, token).then((res) => {
              if (!res) {
                return; /* Cancelled */
              }
              const [progressHandle, progressContent] = res;
              const convertedContent = convertProgress(progressContent, agent.extension);
              if (!convertedContent) {
                this.logger.error('Unknown progress type: ' + JSON.stringify(progressContent));
                return;
              }

              this.proxy.$handleProgressChunk(requestId, convertedContent, progressHandle ?? undefined);
            });
          } else {
            this.proxy.$handleProgressChunk(requestId, convertedProgress);
          }
        }),
        token,
      );

      const result = await raceCancellation(Promise.resolve(task), token);
      if (result) {
        this.previousResultMap.set(sessionId, result);
        let sessionResults = this.resultsBySessionAndRequestId.get(sessionId);
        if (!sessionResults) {
          sessionResults = new Map();
          this.resultsBySessionAndRequestId.set(sessionId, sessionResults);
        }
        sessionResults.set(requestId, result);

        return { errorDetails: result.errorDetails };
      } else {
        this.previousResultMap.delete(sessionId);
      }
    } catch (e) {
      this.logger.error(e, agent.extension);
      return { errorDetails: { message: e?.message || '' } };
    } finally {
      done = true;
    }
  }

  $releaseSession(sessionId: string): void {
    this.previousResultMap.delete(sessionId);
    this.resultsBySessionAndRequestId.delete(sessionId);
  }

  async $provideSlashCommands(handle: number, token: CancellationToken): Promise<IChatAgentCommand[]> {
    const agent = this.agents.get(handle);
    if (!agent) {
      return [];
    }
    return agent.provideSlashCommand(token);
  }

  $provideFollowups(handle: number, sessionId: string, token: CancellationToken): Promise<IChatFollowup[]> {
    const agent = this.agents.get(handle);
    if (!agent) {
      return Promise.resolve([]);
    }

    const result = this.previousResultMap.get(sessionId);
    if (!result) {
      return Promise.resolve([]);
    }

    return agent.provideFollowups(result, token);
  }

  async $provideSampleQuestions(handle: number, token: CancellationToken): Promise<IChatReplyFollowup[]> {
    const agent = this.agents.get(handle);
    if (!agent) {
      return [];
    }
    return agent.provideSampleQuestions(token);
  }

  async $provideChatWelcomeMessage(
    handle: number,
    token: CancellationToken,
  ): Promise<undefined | IChatAgentWelcomeMessage> {
    const agent = this.agents.get(handle);
    if (!agent) {
      return;
    }
    return agent.provideChatWelcomeMessage(token);
  }
}

class ExtHostChatAgent {
  private _slashCommandProvider: vscode.ChatAgentSlashCommandProvider | undefined;
  private _lastSlashCommands: vscode.ChatAgentSlashCommand[] | undefined;
  private _followupProvider: vscode.FollowupProvider | undefined;
  private _chatWelcomeMessageProvider: sumi.ChatAgentWelcomeMessageProvider | undefined;
  private _description: string | undefined;
  private _fullName: string | undefined;
  private _iconPath: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon | undefined;
  private _isDefault: boolean | undefined;
  private _onDidReceiveFeedback = new Emitter<vscode.ChatAgentResult2Feedback>();
  private _onDidPerformAction = new Emitter<vscode.ChatAgentUserActionEvent>();
  private _agentVariableProvider?: { provider: vscode.ChatAgentCompletionItemProvider; triggerCharacters: string[] };
  private _sampleQuestionProvider: sumi.ChatAgentSampleQuestionProvider;

  constructor(
    public readonly extension: IExtensionDescription,
    private readonly _id: string,
    private readonly _proxy: IMainThreadChatAgents,
    private readonly _handle: number,
    private readonly _callback: sumi.ChatAgentHandler,
  ) {}

  acceptFeedback(feedback: vscode.ChatAgentResult2Feedback) {
    this._onDidReceiveFeedback.fire(feedback);
  }

  acceptAction(event: vscode.ChatAgentUserActionEvent) {
    this._onDidPerformAction.fire(event);
  }

  async invokeCompletionProvider(query: string, token: CancellationToken): Promise<vscode.ChatAgentCompletionItem[]> {
    if (!this._agentVariableProvider) {
      return [];
    }

    return (await this._agentVariableProvider.provider.provideCompletionItems(query, token)) ?? [];
  }

  async validateSlashCommand(command: string) {
    if (!this._lastSlashCommands) {
      await this.provideSlashCommand(CancellationToken.None);
      if (!this._lastSlashCommands) {
        throw Error(`Unknown slashCommand: ${command}`);
      }
    }
    const result = this._lastSlashCommands.find((candidate) => candidate.name === command);
    if (!result) {
      throw new Error(`Unknown slashCommand: ${command}`);
    }
    return result;
  }

  async provideSlashCommand(token: CancellationToken): Promise<IChatAgentCommand[]> {
    if (!this._slashCommandProvider) {
      return [];
    }
    const result = await this._slashCommandProvider.provideSlashCommands(token);
    if (!result) {
      return [];
    }
    this._lastSlashCommands = result;
    return result.map((c) => ({
      name: c.name,
      description: c.description,
      followupPlaceholder: c.followupPlaceholder,
      shouldRepopulate: c.shouldRepopulate,
      sampleRequest: c.sampleRequest,
    }));
  }

  async provideFollowups(result: vscode.ChatAgentResult2, token: CancellationToken): Promise<IChatFollowup[]> {
    if (!this._followupProvider) {
      return [];
    }
    const followups = await this._followupProvider.provideFollowups(result, token);
    if (!followups) {
      return [];
    }
    return followups.map((f) => typeConverters.ChatFollowup.from(f));
  }

  async provideSampleQuestions(token: CancellationToken): Promise<IChatReplyFollowup[]> {
    if (!this._sampleQuestionProvider) {
      return [];
    }
    const result = await this._sampleQuestionProvider.provideSampleQuestions(token);
    if (!result) {
      return [];
    }
    return result.map((f) => typeConverters.ChatReplyFollowup.from(f));
  }

  async provideChatWelcomeMessage(token: CancellationToken): Promise<undefined | IChatAgentWelcomeMessage> {
    if (!this._chatWelcomeMessageProvider) {
      return;
    }

    const result = await this._chatWelcomeMessageProvider.provideChatWelcomeMessage(token);

    if (!result) {
      return;
    }

    return {
      ...result,
      sampleQuestions: (result.sampleQuestions ?? []).map((f) => typeConverters.ChatReplyFollowup.from(f)),
    };
  }

  get apiAgent(): sumi.ChatAgent {
    let disposed = false;
    let updateScheduled = false;
    const updateMetadataSoon = () => {
      if (disposed) {
        return;
      }
      if (updateScheduled) {
        return;
      }
      updateScheduled = true;
      queueMicrotask(() => {
        this._proxy.$updateAgent(this._handle, {
          description: this._description ?? '',
          fullName: this._fullName,
          hasSlashCommands: this._slashCommandProvider !== undefined,
          hasFollowups: this._followupProvider !== undefined,
          hasSampleQuestions: this._sampleQuestionProvider !== undefined,
          hasChatWelcomMessage: this._chatWelcomeMessageProvider !== undefined,
          isDefault: this._isDefault,
        });
        updateScheduled = false;
      });
    };

    const that = this;
    return {
      get name() {
        return that._id;
      },
      get description() {
        return that._description ?? '';
      },
      set description(v) {
        that._description = v;
        updateMetadataSoon();
      },
      get fullName() {
        return that._fullName ?? that.extension.displayName ?? that.extension.name;
      },
      set fullName(v) {
        that._fullName = v;
        updateMetadataSoon();
      },
      get iconPath() {
        return that._iconPath;
      },
      set iconPath(v) {
        that._iconPath = v;
        updateMetadataSoon();
      },
      get slashCommandProvider() {
        return that._slashCommandProvider;
      },
      set slashCommandProvider(v) {
        that._slashCommandProvider = v;
        updateMetadataSoon();
      },
      get followupProvider() {
        return that._followupProvider;
      },
      set followupProvider(v) {
        that._followupProvider = v;
        updateMetadataSoon();
      },
      get isDefault() {
        return that._isDefault;
      },
      set isDefault(v) {
        that._isDefault = v;
        updateMetadataSoon();
      },
      get chatWelcomMessageProvider() {
        return that._chatWelcomeMessageProvider;
      },
      set chatWelcomMessageProvider(v) {
        that._chatWelcomeMessageProvider = v;
        updateMetadataSoon();
      },
      get sampleQuestionProvider() {
        return that._sampleQuestionProvider;
      },
      set sampleQuestionProvider(v) {
        that._sampleQuestionProvider = v;
        updateMetadataSoon();
      },
      get onDidReceiveFeedback() {
        return that._onDidReceiveFeedback.event;
      },
      onDidPerformAction: this._onDidPerformAction.event,
      populateChatInput: (param: sumi.ChatAgentPopulateInputParam) => {
        this._proxy.$populateChatInput(this._handle, {
          command: param.command,
          prompt: param.prompt,
        });
      },
      dispose() {
        disposed = true;
        that._slashCommandProvider = undefined;
        that._followupProvider = undefined;
        that._onDidReceiveFeedback.dispose();
        that._proxy.$unregisterAgent(that._handle);
      },
    };
  }

  invoke(
    request: vscode.ChatAgentRequest,
    context: vscode.ChatAgentContext,
    progress: Progress<sumi.ChatAgentProgress>,
    token: CancellationToken,
  ): vscode.ProviderResult<vscode.ChatAgentResult2> {
    return this._callback(request, context, progress, token);
  }
}

export function createChatApiFactory(extension: IExtensionDescription, extHostChatAgents: ExtHostChatAgents) {
  return {
    createChatAgent(name: string, handler: sumi.ChatAgentHandler) {
      return extHostChatAgents.createChatAgent(extension, name, handler);
    },
    sendMessage(chunk: sumi.ChatAgentContent) {
      return extHostChatAgents.sendMessage(extension, chunk);
    },
  };
}

export function convertProgress(
  progress: sumi.ChatAgentProgress,
  extension: IExtensionDescription,
): IChatProgressChunk | undefined {
  if ('placeholder' in progress && 'resolvedContent' in progress) {
    return { content: progress.placeholder, kind: 'asyncContent' };
  } else if ('markdownContent' in progress) {
    return { content: typeConverters.MarkdownString.from(progress.markdownContent), kind: 'markdownContent' };
  } else if ('content' in progress) {
    if (typeof progress.content === 'string') {
      return { content: progress.content, kind: 'content' };
    }
    return { content: typeConverters.MarkdownString.from(progress.content), kind: 'markdownContent' };
  } else if ('treeData' in progress) {
    return { treeData: progress.treeData, kind: 'treeData' };
  } else if ('component' in progress) {
    return {
      component: `${extension.identifier.value}:${progress.component}`,
      value: progress.value,
      kind: 'component',
    };
  } else {
    return undefined;
  }
}
