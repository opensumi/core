import { AbstractSumiBrowserContributionRunner, IRunTimeParams } from '../types';
import { IDisposable, Disposable } from '@opensumi/ide-core-common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/common-di';
import { TabbarBrowserContributionRunner } from './tabbar';
import { EditorBrowserContributionRunner } from './editor';
import { ToolBarBrowserContributionRunner } from './toolbar';

@Injectable({multiple: true})
export class SumiBrowserContributionRunner extends AbstractSumiBrowserContributionRunner {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  run(param: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    disposer.addDispose(this.injector.get(TabbarBrowserContributionRunner, [this.extension, this.contribution]).run(param));
    disposer.addDispose(this.injector.get(EditorBrowserContributionRunner, [this.extension, this.contribution]).run(param));
    disposer.addDispose(this.injector.get(ToolBarBrowserContributionRunner, [this.extension, this.contribution]).run(param));
    return disposer;
  }

}
