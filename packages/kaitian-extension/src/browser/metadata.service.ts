import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IExtension } from '../common';
import { Disposable, ILogger } from '@ali/ide-core-browser';
import { IActivationEventService } from './types';
import { IEventBus, ExtensionEnabledEvent } from '@ali/ide-core-common';
import { VSCodeContributeRunner } from './vscode/contributes';
import { KaitianContributesRunner } from './kaitian/contributes';

@Injectable({multiple: true})
export class ExtensionMetadataService extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired()
  private activationService: IActivationEventService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  /**
   * 执行 contributes
   * 监听 activationEvent 和 workspaceContains
   */
  public async run(extension: IExtension) {
    try {
      const runner = this.injector.get(VSCodeContributeRunner, [extension]);
      const ktRunner = this.injector.get(KaitianContributesRunner, [extension]);
      this.addDispose(runner);
      this.addDispose(ktRunner);
      this.eventBus.fire(new ExtensionEnabledEvent(extension.toJSON()));
      await Promise.all([
        runner.run(),
        ktRunner.run(),
      ]);

      this.addDispose(this.registerActivationEvent(extension));
    } catch (e) {
      this.logger.error('vscode meta启用插件出错' + extension.name);
      this.logger.error(e);
    }
  }

  private registerActivationEvent(extension: IExtension) {
    const { activationEvents = [] } = extension.packageJSON;
    const activateDisposer = new Disposable();

    // FIXME: 这块目前沿用 vscode 的激活启动方式，考虑是否扩展部分有独立设置
    activationEvents.forEach((event) => {
      // https://code.visualstudio.com/api/references/activation-events#onUri
      // 绑定含有当前插件 id 的 onUri activation event
      // 只有打开 uri 的 id 匹配才会触发执行
      if (event === 'onUri') {
        event = `onUri:${extension.id}`;
      }
      activateDisposer.addDispose(this.activationService.onEvent(event, async () => {
        await extension.activate();
        activateDisposer.dispose();
      }));
    });

    return activateDisposer;
  }

}
