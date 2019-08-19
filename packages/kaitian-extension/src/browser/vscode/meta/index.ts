import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { VSCodeContributeRunner } from './contributes';
import { IExtension } from '../../../common';
import { Disposable } from '@ali/ide-core-browser';
import { ActivationEventService } from '@ali/ide-activation-event';

@Injectable({multiple: true})
export class VSCodeMetaService extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired()
  private activationService: ActivationEventService;

  public async run(extension: IExtension) {
    const runner = this.injector.get(VSCodeContributeRunner, [extension]);
    await runner.run();
    await this.registerActivationEvent(extension);
  }

  private registerActivationEvent(extension: IExtension) {
    const { activationEvents = [] } = extension.packageJSON;
    const activateDisposer = new Disposable();

    activationEvents.forEach((event) => {
      this.activationService.onEvent(event, async () => {
        await extension.activate();
        activateDisposer.dispose();
      });
    });
  }

}
