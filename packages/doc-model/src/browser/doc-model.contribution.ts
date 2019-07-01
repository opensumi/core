import { Domain } from '@ali/ide-core-common';
import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { MonacoService, ServiceNames, MonacoContribution } from '@ali/ide-monaco';

@Domain(MonacoContribution)
export class DocModelContribution implements MonacoContribution  {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  onMonacoLoaded(monacoService: MonacoService) {
    const { MonacoTextModelService } = require('./doc-model.override');
    const textModelService = this.injector.get(MonacoTextModelService);
    monacoService.registerOverride(ServiceNames.TEXT_MODEL_SERVICE, textModelService);
  }
}
