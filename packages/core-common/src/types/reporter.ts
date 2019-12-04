export enum REPORT_HOST {
  BROWSER = 'browser',
  NODE = 'node',
  WORKER = 'worker',
}

export enum REPORT_TYPE {
  PERFORMANCE = 'performance',
  POINT = 'point'
}

export const ReporterMetadata = Symbol('ReporterMetadata');
export interface ReporterMetadata {
  extensionId?: string;
  extensionVersion?: string;
  host?: REPORT_HOST;
}

export interface PointData {
  metadata?: ReporterMetadata;
  msg?: string;
}

export interface PerformanceData extends PointData {
  time: number;
}

// ide-framework 调用
export const IReporterService = Symbol('IReporterService');
export interface IReporterService {
  time(name: string): void;
  timeEnd(name: string, msg?: string): void;
  point(name: string, msg?: string): void;
}

// 集成方实现
// 前端和后端各有一套实现
export const IReporter = Symbol('IReporter');

export interface IReporter {
  performance(name: string, data: PerformanceData): void;
  point(name: string, data: PointData): void;
}

export interface ReporterProcessMessage {
  reportType: REPORT_TYPE,
  name: string,
  data: PerformanceData | PointData,
}
