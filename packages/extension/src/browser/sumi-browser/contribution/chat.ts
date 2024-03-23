import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IChatAgentViewService } from '@opensumi/ide-ai-native/lib/browser/types';
import { ChatAgentViewServiceToken, Disposable, IDisposable, ILogger } from '@opensumi/ide-core-common';

import { AbstractSumiBrowserContributionRunner, IRunTimeParams } from '../types';

@Injectable({ multiple: true })
export class ChatBrowserContributionRunner extends AbstractSumiBrowserContributionRunner {
  @Autowired(ChatAgentViewServiceToken)
  chatAgentViewService: IChatAgentViewService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  run(param: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    if (!this.injector.creatorMap.has(ChatAgentViewServiceToken)) {
      this.logger.warn('Not found ChatAgentViewServiceToken');
      return disposer;
    }

    const { chat } = this.contribution;
    if (!chat || !Array.isArray(chat.view)) {
      return disposer;
    }

    chat.view.forEach((view) => {
      if (!view.id || !view.component) {
        return;
      }
      const { extendProtocol, extendService } = param.getExtensionExtendService(this.extension, view.id);
      const componentId = `${this.extension.id}:${view.id}`;
      disposer.addDispose(
        this.chatAgentViewService.registerChatComponent({
          id: componentId,
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
