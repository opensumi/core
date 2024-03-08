import { Autowired, Injectable } from '@opensumi/di';

import { IPerformance, IReporterService, REPORT_NAME } from './types';
import { MaybePromise } from './utils';

@Injectable()
export class Performance implements IPerformance {
  @Autowired(IReporterService)
  reporterService: IReporterService;

  async measure<T>(name: string, fn: () => MaybePromise<T>): Promise<T> {
    const measureReporter = this.reporterService.time(REPORT_NAME.MEASURE);
    const result = await fn();
    measureReporter.timeEnd(name);
    return result;
  }
}
