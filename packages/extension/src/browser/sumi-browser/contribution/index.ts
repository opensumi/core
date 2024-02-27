import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';

import { AbstractSumiBrowserContributionRunner, IRunTimeParams } from '../types';

import { EditorBrowserContributionRunner } from './editor';
import { EditorSideBrowserContributionRunner } from './editorSide';
import { TabbarBrowserContributionRunner } from './tabbar';
import { ToolBarBrowserContributionRunner } from './toolbar';

@Injectable({ multiple: true })
export class SumiBrowserContributionRunner extends AbstractSumiBrowserContributionRunner {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  run(param: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    disposer.addDispose(
      this.injector.get(TabbarBrowserContributionRunner, [this.extension, this.contribution]).run(param),
    );
    disposer.addDispose(
      this.injector.get(EditorBrowserContributionRunner, [this.extension, this.contribution]).run(param),
    );
    disposer.addDispose(
      this.injector.get(EditorSideBrowserContributionRunner, [this.extension, this.contribution]).run(param),
    );
    disposer.addDispose(
      this.injector.get(ToolBarBrowserContributionRunner, [this.extension, this.contribution]).run(param),
    );
    return disposer;
  }
}
