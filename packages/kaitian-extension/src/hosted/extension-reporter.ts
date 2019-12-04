import { ReporterService, ReporterMetadata, IReporter, PerformanceData, PointData, Emitter, ReporterProcessMessage, REPORT_TYPE } from '@ali/ide-core-common';

class ExtensionReporter implements IReporter {

  constructor(private emitter: Emitter<ReporterProcessMessage>) {}

  performance(name: string, data: PerformanceData): void {
    this.emitter.fire({
      reportType: REPORT_TYPE.PERFORMANCE,
      name,
      data,
   });
  }

  point(name: string, data: PointData): void {
    this.emitter.fire({
      reportType: REPORT_TYPE.POINT,
      name,
      data,
   });
  }
}

export class ExtensionReporterService extends ReporterService {
  constructor(emitter: Emitter<ReporterProcessMessage>, metadata?: ReporterMetadata) {
    const extensionReporter = new ExtensionReporter(emitter);
    super(extensionReporter, metadata);
  }
}
