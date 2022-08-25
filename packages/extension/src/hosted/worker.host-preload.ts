import path from 'path';

import { Injector } from '@opensumi/di';
import { DefaultReporter, IReporter } from '@opensumi/ide-core-common';

import { setPerformance } from './api/vscode/language/util';
import { ExtensionWorkerHost, initRPCProtocol } from './worker.host';

setPerformance(self.performance);
// make sure Worker cors
if (self.Worker) {
  const _Worker = self.Worker;
  // eslint-disable-next-line no-global-assign
  Worker = function (stringUrl: string | URL, options?: WorkerOptions) {
    const js = `importScripts('${stringUrl}');`;
    options = options || {};
    options.name = options.name || path.basename(stringUrl.toString());
    const blob = new Blob([js], { type: 'application/javascript' });
    return new _Worker(URL.createObjectURL(blob));
  } as any;
}

(() => {
  const protocol = initRPCProtocol();
  const extWorkerInjector = new Injector();

  extWorkerInjector.addProviders({
    token: IReporter,
    useValue: new DefaultReporter(),
  });

  new ExtensionWorkerHost(protocol, extWorkerInjector);
})();
