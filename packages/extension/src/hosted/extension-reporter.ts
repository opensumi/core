import {
  Emitter,
  IReporter,
  PerformanceData,
  PointData,
  REPORT_TYPE,
  ReporterProcessMessage,
} from '@opensumi/ide-core-common';

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
