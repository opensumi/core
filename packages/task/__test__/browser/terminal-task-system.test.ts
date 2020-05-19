import { ITaskSystem } from '@ali/ide-task/lib/common';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { TerminalTaskSystem } from '@ali/ide-task/lib/browser/terminal-task-system';

describe('TerminalTaskSystem Test Suite', () => {
  const injector: MockInjector = createBrowserInjector([]);
  injector.addProviders(...[
    {
      token: ITaskSystem,
      useClass: TerminalTaskSystem,
    },
  ]);

  it('happy test', (done) => {
    done();
  });
});
