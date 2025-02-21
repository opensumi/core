import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  DisposableMap,
  IChatProgress,
} from '@opensumi/ide-core-common';
import { ChatMessageRole } from '@opensumi/ide-core-common/lib/types/ai-native';
import { IChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

import { IChatAgentService } from '../../common';

import { ChatModel, ChatRequestModel } from './chat-model';

@Injectable()
export class ChatManagerService extends Disposable {
  #sessionModels = this.registerDispose(new DisposableMap<string, ChatModel>());
  #pendingRequests = this.registerDispose(new DisposableMap<string, CancellationTokenSource>());

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IChatAgentService)
  chatAgentService: IChatAgentService;

  constructor() {
    super();
  }

  getSessions() {
    return Array.from(this.#sessionModels.values());
  }

  startSession() {
    const model = this.injector.get(ChatModel);
    this.#sessionModels.set(model.sessionId, model);
    return model;
  }

  getSession(sessionId: string): ChatModel | undefined {
    return this.#sessionModels.get(sessionId);
  }

  clearSession(sessionId: string) {
    const model = this.#sessionModels.get(sessionId) as ChatModel;
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    this.#sessionModels.disposeKey(sessionId);
    this.#pendingRequests.get(sessionId)?.cancel();
    this.#pendingRequests.disposeKey(sessionId);
  }

  createRequest(sessionId: string, message: string, agentId: string, command?: string) {
    const model = this.getSession(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }

    if (this.#pendingRequests.has(sessionId)) {
      return;
    }

    return model.addRequest({ prompt: message, agentId, command });
  }

  async sendRequest(sessionId: string, request: ChatRequestModel, regenerate: boolean) {
    const model = this.getSession(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }

    const source = new CancellationTokenSource();
    const token = source.token;
    this.#pendingRequests.set(model.sessionId, source);
    const listener = token.onCancellationRequested(() => {
      request.response.cancel();
    });

    const history: IChatMessage[] = [];
    for (const request of model.requests) {
      if (!request.response.isComplete) {
        continue;
      }
      history.push({ role: ChatMessageRole.User, content: request.message.prompt });
      history.push({ role: ChatMessageRole.Assistant, content: request.response.responseText });
    }

    try {
      const progressCallback = (progress: IChatProgress) => {
        if (token.isCancellationRequested) {
          return;
        }
        model.acceptResponseProgress(request, progress);
      };
      const requestProps = {
        sessionId,
        requestId: request.requestId,
        message: request.message.prompt,
        command: request.message.command,
        regenerate,
      };
      const result = await this.chatAgentService.invokeAgent(
        request.message.agentId,
        requestProps,
        progressCallback,
        history,
        token,
      );

      if (!token.isCancellationRequested) {
        if (result.errorDetails) {
          request.response.setErrorDetails(result.errorDetails);
        }
        const followups = this.chatAgentService.getFollowups(
          request.message.agentId,
          sessionId,
          CancellationToken.None,
        );
        followups.then((followups) => {
          request.response.setFollowups(followups);
          request.response.complete();
        });
      }
    } finally {
      listener.dispose();
      this.#pendingRequests.disposeKey(model.sessionId);
    }
  }

  cancelRequest(sessionId: string) {
    this.#pendingRequests.get(sessionId)?.cancel();
    this.#pendingRequests.disposeKey(sessionId);
  }
}
