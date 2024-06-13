import { Inject, Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-utils';

import { getDebugLogger } from './log';
import {
  IReporter,
  IReporterService,
  IReporterTimer,
  IReporterTimerEndOptions,
  PerformanceData,
  PointData,
  REPORT_NAME,
  ReporterMetadata,
} from './types/reporter';

class ReporterTimer implements IReporterTimer {
  private now: number;
  constructor(private name: string, private reporter: IReporter, private metadata?: ReporterMetadata) {
    this.now = Date.now();
  }

  getElapsedTime() {
    return Date.now() - this.now;
  }

  timeEnd(msg?: string, extra?: any, options?: IReporterTimerEndOptions) {
    const duration = this.getElapsedTime();

    if (options?.minimumReportThresholdTime && duration < options.minimumReportThresholdTime) {
      // 不满足最小时间要求，不上报
      return duration;
    }

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
