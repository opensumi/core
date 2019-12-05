import { Injector } from '@ali/common-di';
import { INodeLogger, NodeLogger } from '../logger/node-logger';
import { IReporter, DefaultReporter, IReporterService, ReporterService, ReporterMetadata, REPORT_HOST } from '@ali/ide-core-common';

export function injectInnerProviders(injector: Injector) {
  injector.addProviders({
    token: INodeLogger,
    useClass: NodeLogger,
  }, {
    token: IReporter,
    useClass: DefaultReporter,
  },
  {
    token: IReporterService,
    useClass: ReporterService,
  },
  {
    token: ReporterMetadata,
    useValue: {
      host: REPORT_HOST.NODE,
    },
  });
}
