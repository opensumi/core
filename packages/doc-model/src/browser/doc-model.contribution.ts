import { Domain } from '@ali/ide-core-common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { MonacoService, ServiceNames } from '@ali/ide-monaco';

@Injectable()
@Domain(ClientAppContribution)
export class DocModelContribution implements ClientAppContribution  {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired()
  monacoService: MonacoService;

  waitUntilMonacoLoaded() {
    return new Promise((resolve, reject) => {
      this.monacoService.onMonacoLoaded((loaded) => {
        if (loaded) {
          resolve();
        } else {
          reject();
        }
      });
    });
  }

  onStart() {
    this.waitUntilMonacoLoaded().then(() => {
      const { MonacoTextModelService } = require('./doc-model.override');
      const textModelService = this.injector.get(MonacoTextModelService);
      this.monacoService.registerOverride(ServiceNames.TEXT_MODEL_SERVICE, textModelService);
    });
  }

}
