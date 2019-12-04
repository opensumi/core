import { Injector, Injectable, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadReporterIdentifier, IMainThreadReporter } from '../common';
import { IReporter, PerformanceData, PointData } from '@ali/ide-core-common';

@Injectable()
class MainThreadReporter implements IMainThreadReporter {

  @Autowired(IReporter)
  reporter: IReporter;

  $performance(name: string, data: PerformanceData ): void {
    this.reporter.performance(name, data);
  }

  $point(name: string, data: PointData ): void {
    this.reporter.point(name, data);
  }
}

export function createReporterFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
) {
  rpcProtocol.set<IMainThreadReporter>(MainThreadReporterIdentifier, injector.get(MainThreadReporter));
}
