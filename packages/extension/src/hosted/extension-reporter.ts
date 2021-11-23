import { IReporter, PerformanceData, PointData, Emitter, ReporterProcessMessage, REPORT_TYPE } from '@ide-framework/ide-core-common';

export class ExtensionReporter implements IReporter {

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
