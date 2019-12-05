import { IReporterService, ReporterMetadata, IReporter, PerformanceData, PointData } from './types/reporter';
import { ILogger, getLogger } from './log';
import { Injectable, Inject } from '@ali/common-di';
import { IDisposable } from './disposable';

@Injectable()
export class DefaultReporter implements IReporter {
  private logger: ILogger = getLogger();
  performance (name: string, data: PerformanceData): void {
    this.logger.log(name, data)
  }
  point (name: string, data: PointData): void {
    this.logger.log(name, data)
  }
}

@Injectable()
export class ReporterService implements IReporterService, IDisposable {

  private timeMap = new Map<string, number>();

  constructor(@Inject(IReporter) private reporter: IReporter, @Inject(ReporterMetadata) private metadata?: ReporterMetadata) {}

  time(name: string): void {
    this.timeMap.set(name, Date.now());
  }
  timeEnd(name: string, msg?: string): void {
    const startTime = this.timeMap.get(name);
    if (startTime) {
      this.reporter.performance(name, {
        duration: Date.now() - startTime,
        metadata: this.metadata,
        msg,
      });
      this.timeMap.delete(name);
    }
  }

  point(name: string, msg?: string): void {
    this.reporter.point(name, {
      metadata: this.metadata,
      msg,
    });
  }

  dispose() {
    this.timeMap.clear();
  }
}
