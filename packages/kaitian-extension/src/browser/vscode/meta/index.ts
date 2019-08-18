import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { VSCodeContributeRunner } from './contributes';
import { IExtensionMetaData } from '../../../common';
import { Disposable } from '@ali/ide-core-browser';

@Injectable({multiple: true})
export class VSCodeMetaService extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  public async run(extensionMetaData: IExtensionMetaData) {
    const runner = this.injector.get(VSCodeContributeRunner, [extensionMetaData]);
    await runner.run();
  }
}
