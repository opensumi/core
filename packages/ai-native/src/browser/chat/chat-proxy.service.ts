import { Autowired, Injectable } from '@opensumi/di';
import {
  AIBackSerivcePath,
  CancellationToken,
  Deferred,
  Disposable,
  IAIBackService,
  IAIReporter,
  IChatProgress,
  IChatProxyRPCService
} from '@opensumi/ide-core-common';
import { IChatAgentCommand, IChatAgentRequest, IChatAgentResult, IChatAgentService, IChatAgentWelcomeMessage, IChatInternalService, IChatManagerService, IChatMessage } from '../../common';
import { MsgStreamManager } from '../model/msg-stream-manager';
import { ChatManagerService } from './chat-manager.service';
import { ChatInternalService } from './chat.internal.service';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';

/**
 * @internal
 */
@Injectable()
export class ChatProxyService extends Disposable implements IChatProxyRPCService {
  @Autowired(IChatAgentService)
  private readonly chatAgentService: IChatAgentService;

  @Autowired(IChatInternalService)
  private readonly chatInternalService: ChatInternalService;

  @Autowired(AIBackSerivcePath)
  private aiBackService: IAIBackService;

  @Autowired(MsgStreamManager)
  private readonly msgStreamManager: MsgStreamManager;

  @Autowired(IChatManagerService)
  private chatManagerService: ChatManagerService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private chatDeferred: Deferred<void>;
  private currentChatRequest: IChatAgentRequest | undefined;

  constructor() {
    super();

    this.resetChatDeferred();
  }

  private resetChatDeferred(): void {
    this.chatDeferred = new Deferred<void>();
  }

  // private findRequest(requestId: string): IChatAgentRequest | undefined {
  //   const model = this.chatManagerService.getSession(requestId);
  //   const request = model?.getRequest(requestId);
  // }

  public complete(requestId: string): void {
    this.chatDeferred.resolve();

    // const model = this.chatManagerService.getSession(this.currentChatRequest.sessionId);
    // const request = model?.getRequest(requestId);

    // request!.response.complete();

    this.currentChatRequest = undefined;
  }

  public sendMessage(message: IChatProgress, requestId: string) {
    if (!this.currentChatRequest) {
      return;
    }

    try {
      const model = this.chatManagerService.getSession(this.currentChatRequest.sessionId);
      const request = model?.getRequest(requestId);

      request!.response.complete();

      if (request) {
        model?.acceptResponseProgress(request, message);
      }

    } catch (error) {
      throw new Error(`sendMessage error: ${error}`);
    }
  }

  public registerDefaultAgent() {
    this.addDispose(
      this.chatAgentService.registerAgent({
        id: 'OpenSumi_Default_Agent',
        metadata: {},
        invoke: async (request: IChatAgentRequest, _progress: (part: IChatProgress) => void, _history: IChatMessage[], token: CancellationToken): Promise<IChatAgentResult> => {
          this.resetChatDeferred();
          this.currentChatRequest = request;

          this.addDispose(token.onCancellationRequested(() => {
            this.complete(request.requestId)
          }))

          const stream = await this.aiBackService.requestStream(
            request.message,
            {
              requestId: request.requestId,
            },
            token,
          );

          listenReadable(stream, {
            onData: (data) => {
              console.log('stream:>>> data', data);
            },
            onEnd() {
              console.log('stream:>>> end');
            },
            onError(error) {
              console.log('stream:>>> error', error);
            }
          })

          await this.chatDeferred.promise;
          return {}
        },
        provideSlashCommands: async (token: CancellationToken): Promise<IChatAgentCommand[]> => [],
        provideChatWelcomeMessage: async (token: CancellationToken): Promise<IChatAgentWelcomeMessage | undefined> => undefined,
      })
    )
  }
}
