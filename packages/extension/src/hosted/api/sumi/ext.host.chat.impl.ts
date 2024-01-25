import type * as vscode from 'vscode';

import { IChatAgentCommand, IChatAgentRequest, IChatAgentResult, IChatMessage } from '@opensumi/ide-ai-native';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { CancellationToken, Emitter, Progress, getDebugLogger, raceCancellation } from '@opensumi/ide-core-common';

import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import { IMainThreadChatAgents, IExtHostChatAgents } from '../../../common/sumi/chat-agents';
import { IExtensionDescription } from '../../../common/vscode';

/**
 * ai native chat
 */

export class ExtHostChatAgents implements IExtHostChatAgents {
  private static idPool = 0;

  private proxy: IMainThreadChatAgents;
  private readonly agents = new Map<number, ExtHostChatAgent>();
  private readonly logger = getDebugLogger();

  constructor(private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadChatAgents);
  }

  createChatAgent(extension: IExtensionDescription, name: string, handler: vscode.ChatAgentExtendedHandler) {
    const handle = ExtHostChatAgents.idPool++;
    const agent = new ExtHostChatAgent(extension, name, this.proxy, handle, handler);
    this.agents.set(handle, agent);
    this.proxy.$registerAgent(handle, name, {});
    return agent.apiAgent;
  }

  async $invokeAgent(
    handle: number,
    sessionId: string,
    requestId: string,
    request: IChatAgentRequest,
    context: { history: IChatMessage[] },
    token: CancellationToken,
  ): Promise<IChatAgentResult | undefined> {
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

    const slashCommand = request.command ? await agent.validateSlashCommand(request.command) : undefined;

    try {
      const task = agent.invoke(
        {
          prompt: request.message,
          variables: {},
          slashCommand,
        },
        { history: [] },
        // 暂时只支持 { content: string } 格式的数据
        new Progress<vscode.ChatAgentContent>((data) => {
          throwIfDone();

          if (!data || !data.content) {
            this.logger.error('Unknown progress type: ' + JSON.stringify(data));
            return;
          }

          this.proxy.$handleProgressChunk(requestId, { content: data.content, kind: 'content' });
        }),
        token,
      );

      const result = await raceCancellation(Promise.resolve(task), token);
      if (result) {
        return { errorDetails: result.errorDetails };
      }
    } catch (e) {
      this.logger.error(e, agent.extension);
      return { errorDetails: { message: e?.message || '' } };
    } finally {
      done = true;
    }
  }

  async $provideSlashCommands(handle: number, token: CancellationToken): Promise<IChatAgentCommand[]> {
    const agent = this.agents.get(handle);
    if (!agent) {
      return [];
    }
    return agent.provideSlashCommand(token);
  }
}

class ExtHostChatAgent {
  private _slashCommandProvider: vscode.ChatAgentSlashCommandProvider | undefined;
  private _lastSlashCommands: vscode.ChatAgentSlashCommand[] | undefined;
  private _followupProvider: vscode.FollowupProvider | undefined;
  private _description: string | undefined;
  private _fullName: string | undefined;
  private _iconPath: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon | undefined;
  private _isDefault: boolean | undefined;
  private _onDidReceiveFeedback = new Emitter<vscode.ChatAgentResult2Feedback>();
  private _onDidPerformAction = new Emitter<vscode.ChatAgentUserActionEvent>();
  private _agentVariableProvider?: { provider: vscode.ChatAgentCompletionItemProvider; triggerCharacters: string[] };

  constructor(
    public readonly extension: IExtensionDescription,
    private readonly _id: string,
    private readonly _proxy: IMainThreadChatAgents,
    private readonly _handle: number,
    private readonly _callback: vscode.ChatAgentExtendedHandler,
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

  get apiAgent(): vscode.ChatAgent2 {
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
      get onDidReceiveFeedback() {
        return that._onDidReceiveFeedback.event;
      },
      onDidPerformAction: this._onDidPerformAction.event,
      dispose() {
        disposed = true;
        that._slashCommandProvider = undefined;
        that._followupProvider = undefined;
        that._onDidReceiveFeedback.dispose();
        that._proxy.$unregisterAgent(that._handle);
      },
    } satisfies vscode.ChatAgent2;
  }

  invoke(
    request: vscode.ChatAgentRequest,
    context: vscode.ChatAgentContext,
    progress: Progress<vscode.ChatAgentExtendedProgress>,
    token: CancellationToken,
  ): vscode.ProviderResult<vscode.ChatAgentResult2> {
    return this._callback(request, context, progress, token);
  }
}

export function createChatApiFactory(extension: IExtensionDescription, extHostChatAgents: ExtHostChatAgents) {
  return {
    createChatAgent(name: string, handler: vscode.ChatAgentExtendedHandler) {
      return extHostChatAgents.createChatAgent(extension, name, handler);
    },
  };
}
