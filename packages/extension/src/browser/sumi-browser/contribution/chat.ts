import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IChatAgentViewService } from '@opensumi/ide-ai-native/lib/browser/types';
import { IDisposable, Disposable, ILogger } from '@opensumi/ide-core-common';

import { IRunTimeParams, AbstractSumiBrowserContributionRunner } from '../types';

@Injectable({ multiple: true })
export class ChatBrowserContributionRunner extends AbstractSumiBrowserContributionRunner {
  @Autowired(IChatAgentViewService)
  chatAgentViewService: IChatAgentViewService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  run(param: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    if (!this.injector.creatorMap.has(IChatAgentViewService)) {
      this.logger.warn('没有找到 IChatAgentViewService');
      return disposer;
    }

    const { chat } = this.contribution;
    if (!chat) {
      return disposer;
    }

    chat.view.forEach((view) => {
      const { extendProtocol, extendService } = param.getExtensionExtendService(this.extension, view.id);
      disposer.addDispose(
        this.chatAgentViewService.registerChatComponent({
          id: view.id,
          component: view.component as React.ComponentType,
          initialProps: {
            kaitianExtendService: extendService,
            kaitianExtendSet: extendProtocol,
            sumiExtendService: extendService,
            sumiExtendSet: extendProtocol,
          },
        }),
      );
    });

    return disposer;
  }
}
