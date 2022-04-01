import { ITaskSystem } from '@opensumi/ide-core-common/lib/tasks';
import { TerminalTaskSystem } from '@opensumi/ide-task/lib/browser/terminal-task-system';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('TerminalTaskSystem Test Suite', () => {
  const injector: MockInjector = createBrowserInjector([]);
  injector.addProviders(
    ...[
      {
        token: ITaskSystem,
        useClass: TerminalTaskSystem,
      },
    ],
  );

  it('happy test', (done) => {
    done();
  });
});
