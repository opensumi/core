import { Injectable, Inject } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-utils';

import { getDebugLogger } from './log';
import {
  IReporterService,
  ReporterMetadata,
  IReporter,
  PerformanceData,
  PointData,
  IReporterTimer,
  REPORT_NAME,
} from './types/reporter';

class ReporterTimer implements IReporterTimer {
  private now: number;
  constructor(private name: string, private reporter: IReporter, private metadata?: ReporterMetadata) {
    this.now = Date.now();
  }

  timeEnd(msg?: string, extra?: any) {
    const duration = Date.now() - this.now;
    this.reporter.performance(this.name, {
      duration,
      metadata: this.metadata,
      msg,
      extra,
    });
    return duration;
  }
}

@Injectable()
export class DefaultReporter implements IReporter {
  private logger = getDebugLogger();
  performance(name: string, data: PerformanceData): void {
    this.logger.log(name, data);
  }
  point(name: string, data: PointData): void {
    this.logger.log(name, data);
  }
}

@Injectable()
export class ReporterService implements IReporterService, IDisposable {
  constructor(
    @Inject(IReporter) private reporter: IReporter,
    @Inject(ReporterMetadata) private metadata?: ReporterMetadata,
  ) {}

  time(name: REPORT_NAME | string): IReporterTimer {
    return new ReporterTimer(name, this.reporter, this.metadata);
  }

  point(name: REPORT_NAME | string, msg?: string, extra?: any): void {
    this.reporter.point(name, {
      metadata: this.metadata,
      msg,
      extra,
    });
  }

  dispose() {}
}
