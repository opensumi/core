import { createMainContextProxyIdentifier } from '@ali/ide-connection';
import { PerformanceData, PointData } from '@ali/ide-core-common';

export interface IMainThreadReporter {
  $performance(name: string, data: PerformanceData): void;
  $point(name: string, data: PointData): void;
}

export const MainThreadReporterIdentifier = createMainContextProxyIdentifier<IMainThreadReporter>('MainThreadReporter');
