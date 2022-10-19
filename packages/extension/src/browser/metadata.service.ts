import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { Disposable, ILogger, IEventBus, ExtensionEnabledEvent } from '@opensumi/ide-core-browser';

import { IExtension } from '../common';

import { SumiContributesRunner } from './sumi/contributes';
import { IActivationEventService } from './types';
import { VSCodeContributeRunner } from './vscode/contributes';

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
    const runner = this.injector.get(VSCodeContributeRunner, [extension]);
    const ktRunner = this.injector.get(SumiContributesRunner, [extension]);
    this.addDispose(runner);
    this.addDispose(ktRunner);
    this.eventBus.fire(new ExtensionEnabledEvent(extension.toJSON()));
    runner.initialize();
    ktRunner.initialize();

    this.addDispose(this.registerActivationEvent(extension));
  }

  /**
   * 执行 contributes
   * 监听 activationEvent 和 workspaceContains
   */
  public async run(extension: IExtension) {
    try {
      const runner = this.injector.get(VSCodeContributeRunner, [extension]);
      const ktRunner = this.injector.get(SumiContributesRunner, [extension]);
      this.addDispose(runner);
      this.addDispose(ktRunner);
      this.eventBus.fire(new ExtensionEnabledEvent(extension.toJSON()));
      await Promise.all([runner.initialize(), ktRunner.initialize()]);

      this.addDispose(this.registerActivationEvent(extension));
    } catch (e) {
      this.logger.error('启用插件时解析元数据出错' + extension.name);
      this.logger.error(e);
    }
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
