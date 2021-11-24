import path from 'path';
import { Injector } from '@ide-framework/common-di';
import { ExtensionWorkerHost, initRPCProtocol } from './worker.host';
import { setPerformance } from './api/vscode/language/util';
import { DefaultReporter, IReporter } from '@ide-framework/ide-core-common';

setPerformance(self.performance);
// make sure Worker cors
if (self.Worker) {
  const _Worker = self.Worker;
  Worker = function(stringUrl: string | URL, options?: WorkerOptions) {
    const js = `importScripts('${stringUrl}');`;
    options = options || {};
    options.name = options.name || path.basename(stringUrl.toString());
    return new _Worker(`data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`, options);
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
