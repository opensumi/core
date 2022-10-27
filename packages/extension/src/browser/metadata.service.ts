import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { Disposable, ILogger, IEventBus, ExtensionEnabledEvent } from '@opensumi/ide-core-browser';

import { IExtension } from '../common';

// import { SumiContributesRunner } from './sumi/contributes';
import { IActivationEventService } from './types';
// import { VSCodeContributeRunner } from './vscode/contributes';

@Injectable({ multiple: true })
export class ExtensionMetadataService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired()
  private activationService: IActivationEventService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  public initialize(extension: IExtension) {
    this.eventBus.fire(new ExtensionEnabledEvent(extension.toJSON()));
    this.addDispose(this.registerActivationEvent(extension));
  }

  private registerActivationEvent(extension: IExtension) {
    const { activationEvents = [] } = extension.packageJSON;
    const activateDisposer = new Disposable();

    activationEvents.forEach((event) => {
      // https://code.visualstudio.com/api/references/activation-events#onUri
      // 绑定含有当前插件 id 的 onUri activation event
      // 只有打开 uri 的 id 匹配才会触发执行
      if (event === 'onUri') {
        event = `onUri:${extension.id}`;
      }
      activateDisposer.addDispose(
        this.activationService.onEvent(event, async () => {
          await extension.activate();
        }),
      );
    });

    return activateDisposer;
  }
}
