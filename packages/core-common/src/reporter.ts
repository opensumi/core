import { IReporterService, ReporterMetadata, IReporter, PerformanceData, PointData, IReporterTimer } from './types/reporter';
import { ILogger, getLogger } from './log';
import { Injectable, Inject } from '@ali/common-di';
import { IDisposable } from './disposable';

class ReporterTimer implements IReporterTimer {
  private now: number;
  constructor(private name: string, private reporter: IReporter, private metadata?: ReporterMetadata) {
    this.now = Date.now();
  }

  timeEnd(msg?: string) {
    this.reporter.performance(this.name, {
      duration: Date.now() - this.now,
      metadata: this.metadata,
      msg,
    });
  }
}

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

  constructor(@Inject(IReporter) private reporter: IReporter, @Inject(ReporterMetadata) private metadata?: ReporterMetadata) {}

  time(name: string): IReporterTimer {
    return new ReporterTimer(name, this.reporter, this.metadata);
  }

  point(name: string, msg?: string): void {
    this.reporter.point(name, {
      metadata: this.metadata,
      msg,
    });
  }

  dispose() {

  }
}
