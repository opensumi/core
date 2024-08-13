import { Injectable, Injector } from '@opensumi/di';
import { ChatInternalService } from '@opensumi/ide-ai-native/lib/browser/chat/chat.internal.service';
import { ERunStrategy, IInlineChatFeatureRegistry } from '@opensumi/ide-ai-native/lib/browser/types';
import { InlineChatController } from '@opensumi/ide-ai-native/lib/browser/widget/inline-chat/inline-chat-controller';
import {
  IChatAgentService,
  IChatAgentWelcomeMessage,
  IChatFollowup,
  IChatReplyFollowup,
} from '@opensumi/ide-ai-native/lib/common';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  Deferred,
  IChatProgress,
  IChatTreeData,
  IMarkdownString,
  InlineChatFeatureRegistryToken,
} from '@opensumi/ide-core-common';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { ExtHostSumiAPIIdentifier } from '../../common/sumi';
import {
  IChatInputParam,
  IExtHostChatAgents,
  IExtensionChatAgentMetadata,
  IInlineChatPreviewProviderMetadata,
  IMainThreadChatAgents,
} from '../../common/sumi/chat-agents';

interface AgentData {
  dispose: () => void;
  name: string;
  isDefault?: boolean;
  hasSlashCommands?: boolean;
  hasFollowups?: boolean;
  hasSampleQuestions?: boolean;
  hasChatWelcomMessage?: boolean;
}

@Injectable({ multiple: true })
export class MainThreadChatAgents implements IMainThreadChatAgents {
  #proxy: IExtHostChatAgents;

  private readonly agents = new Map<number, AgentData>();
  private readonly pendingProgress = new Map<string, (data: IChatProgress) => void>();
  private responsePartHandlePool = 0;
  private readonly activeResponsePartPromises = new Map<string, Deferred<string | IMarkdownString | IChatTreeData>>();

  /**
   * ai-native 由上层业务激活，对应的 service 可能不存在
   */
  get chatAgentService(): IChatAgentService | null {
    try {
      return this.injector.get(IChatAgentService);
    } catch (err) {
      return null;
    }
  }

  get inlineChatFeatureRegistry(): IInlineChatFeatureRegistry | null {
    try {
      return this.injector.get(InlineChatFeatureRegistryToken);
    } catch (err) {
      return null;
    }
  }

  get chatInternalService(): ChatInternalService | null {
    try {
      return this.injector.get(ChatInternalService);
    } catch (err) {
      return null;
    }
  }

  constructor(rpcProtocol: IRPCProtocol, private injector: Injector) {
    this.#proxy = rpcProtocol.getProxy(ExtHostSumiAPIIdentifier.ExtHostChatAgents);
  }
  $registerInlineChatProvider(handle: number, name: string, metadata: IInlineChatPreviewProviderMetadata): void {
    if (!this.inlineChatFeatureRegistry || !this.chatInternalService) {
      return;
    }

    const d = this.inlineChatFeatureRegistry.registerInteractiveInput(
      { handleStrategy: () => ERunStrategy.PREVIEW },
      {
        providerPreviewStrategy: async (editor, value, token) => {
          const controller = new InlineChatController({ enableCodeblockRender: !!metadata.enableCodeblockRender });
          const request = this.chatInternalService!.createRequest(value, name)!;

          const stream = new SumiReadableStream<IChatProgress>();
          controller.mountReadable(stream);

          const progressCallback = (progress: IChatProgress) => {
            if (token.isCancellationRequested) {
              stream.abort();
              return;
            }

            stream.emitData(progress);
          };

          this.pendingProgress.set(request.requestId, progressCallback);
          const requestProps = {
            sessionId: this.chatInternalService?.sessionModel.sessionId!,
            requestId: request.requestId,
            message: request.message.prompt,
            command: request.message.command,
          };
          this.#proxy
            .$invokeAgent(handle, requestProps, { history: [] }, token)
            .then((result) => {
              if (!result) {
                stream.end();
                return;
              }

              if (!token.isCancellationRequested) {
                if (result.errorDetails) {
                  request.response.setErrorDetails(result.errorDetails);
                }
                stream.end();
              } else {
                stream.abort();
              }
            })
            .finally(() => {
              this.pendingProgress.delete(request.requestId);
            });

          return controller;
        },
      },
    );

    this.agents.set(handle, {
      name,
      dispose: d.dispose,
    });
  }

  $registerAgent(handle: number, name: string, metadata: IExtensionChatAgentMetadata) {
    if (!this.chatAgentService) {
      return;
    }
    const d = this.chatAgentService.registerAgent({
      id: name,
      metadata,
      invoke: async (request, progress, history, token) => {
        this.pendingProgress.set(request.requestId, progress);
        try {
          return (await this.#proxy.$invokeAgent(handle, request, { history }, token)) ?? {};
        } finally {
          this.pendingProgress.delete(request.requestId);
        }
      },
      provideSlashCommands: async (token) => {
        if (!this.agents.get(handle)?.hasSlashCommands) {
          return [];
        }
        return this.#proxy.$provideSlashCommands(handle, token);
      },
      provideFollowups: async (sessionId, token): Promise<IChatFollowup[]> => {
        if (!this.agents.get(handle)?.hasFollowups) {
          return [];
        }
        return this.#proxy.$provideFollowups(handle, sessionId, token);
      },
      provideSampleQuestions: async (token): Promise<IChatReplyFollowup[]> => {
        if (!this.agents.get(handle)?.hasSampleQuestions) {
          return [];
        }
        return this.#proxy.$provideSampleQuestions(handle, token);
      },
      provideChatWelcomeMessage: async (token): Promise<undefined | IChatAgentWelcomeMessage> => {
        if (!this.agents.get(handle)?.hasChatWelcomMessage) {
          return undefined;
        }
        return this.#proxy.$provideChatWelcomeMessage(handle, token);
      },
    });
    this.agents.set(handle, {
      name,
      dispose: d.dispose,
      hasSlashCommands: metadata.hasSlashCommands,
      hasFollowups: metadata.hasFollowups,
    });
  }

  $updateAgent(handle: number, metadataUpdate: IExtensionChatAgentMetadata) {
    if (!this.chatAgentService) {
      return;
    }
    const data = this.agents.get(handle);
    if (!data) {
      throw new Error(`No agent with handle ${handle} registered`);
    }
    data.hasSlashCommands = metadataUpdate.hasSlashCommands;
    data.hasFollowups = metadataUpdate.hasFollowups;
    data.hasSampleQuestions = metadataUpdate.hasSampleQuestions;
    data.hasChatWelcomMessage = metadataUpdate.hasChatWelcomMessage;
    data.isDefault = metadataUpdate.isDefault;
    this.chatAgentService.updateAgent(data.name, metadataUpdate);
  }

  async $handleProgressChunk(
    requestId: string,
    progress: IChatProgress,
    responsePartHandle?: number,
  ): Promise<number | void> {
    if (progress.kind === 'asyncContent') {
      const handle = ++this.responsePartHandlePool;
      const responsePartId = `${requestId}_${handle}`;
      const deferredContentPromise = new Deferred<string | IMarkdownString | IChatTreeData>();
      this.activeResponsePartPromises.set(responsePartId, deferredContentPromise);
      this.pendingProgress.get(requestId)?.({ ...progress, resolvedContent: deferredContentPromise.promise });
      return handle;
    } else if (typeof responsePartHandle === 'number') {
      const responsePartId = `${requestId}_${responsePartHandle}`;
      const deferredContentPromise = this.activeResponsePartPromises.get(responsePartId);
      if (deferredContentPromise) {
        if (progress.kind === 'content') {
          deferredContentPromise.resolve(progress.content);
        } else if (progress.kind === 'treeData') {
          deferredContentPromise.resolve(progress);
        }
        this.activeResponsePartPromises.delete(responsePartId);
      }
      return responsePartHandle;
    }

    this.pendingProgress.get(requestId)?.(progress);
  }

  $unregisterAgent(handle: number) {
    this.agents.get(handle)?.dispose();
    this.agents.delete(handle);
  }

  $populateChatInput(handle: number, param: IChatInputParam) {
    if (!this.chatAgentService) {
      return;
    }
    const data = this.agents.get(handle);
    if (!data) {
      throw new Error(`No agent with handle ${handle} registered`);
    }
    this.chatAgentService.populateChatInput(data.name, {
      command: param.command,
      message: param.prompt,
    });
  }

  $sendMessage(chunk: IChatProgress) {
    if (!this.chatAgentService) {
      return;
    }
    this.chatAgentService.sendMessage(chunk);
  }

  dispose(): void {
    this.agents.forEach((agent) => {
      agent.dispose();
    });
    this.agents.clear();
  }
}
