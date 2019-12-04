import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadReporterIdentifier, IMainThreadReporter } from '../common';
import { ReporterService, ReporterMetadata, IReporter, PerformanceData, PointData, Emitter, ReporterProcessMessage, REPORT_TYPE } from '@ali/ide-core-common';

class ExtensionReporter implements IReporter {

  constructor(private reporter: IMainThreadReporter, private emitter?: Emitter<ReporterProcessMessage>) {}

  performance(name: string, data: PerformanceData): void {
   this.reporter.$performance(name, data);
   this.emitter && this.emitter.fire({
      reportType: REPORT_TYPE.PERFORMANCE,
      name,
      data,
   });
  }

  point(name: string, data: PointData): void {
    this.reporter.$point(name, data);
    this.emitter && this.emitter.fire({
      reportType: REPORT_TYPE.POINT,
      name,
      data,
   });
  }
}

export class ExtensionReporterService extends ReporterService {
  constructor(rpcProtocol: IRPCProtocol, emitter?: Emitter<ReporterProcessMessage>, metadata?: ReporterMetadata) {
    const extensionReporter = new ExtensionReporter(rpcProtocol.getProxy(MainThreadReporterIdentifier), emitter);
    super(extensionReporter, metadata);
  }
}
