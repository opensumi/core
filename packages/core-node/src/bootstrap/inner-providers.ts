import { Injector } from '@opensumi/di';
import { INodeLogger, NodeLogger } from '../logger/node-logger';
import { IReporter, DefaultReporter, IReporterService, ReporterService, ReporterMetadata, REPORT_HOST } from '@opensumi/ide-core-common';
import { HashCalculateServiceImpl, IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';

export function injectInnerProviders(injector: Injector) {
  injector.addProviders(
    {
      token: INodeLogger,
      useClass: NodeLogger,
    },
    {
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
    },
    {
      token: IHashCalculateService,
      useClass: HashCalculateServiceImpl,
    },
  );
}
