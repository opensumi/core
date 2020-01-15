export enum REPORT_NAME {
  ACTIVE_EXTENSION = 'activateExtension',
  RUNTIME_ERROR_EXTENSION = 'runtimeErrorExtension',
  LOAD_EXTENSION_MAIN = 'loadExtensionMain',
  PROVIDE_COMPLETION_ITEMS = 'provideCompletionItems',
  RESOLVE_COMPLETION_ITEM = 'resolveCompletionItem',
  PROVIDE_DOCUMENT_FORMATTING_EDITS = 'provideDocumentFormattingEdits',
  PROVIDE_DOCUMENT_RANGE_FORMATTING_EDITS = 'provideDocumentRangeFormattingEdits',
  CHANNEL_RECONNECT = 'channelReconnect',
  MEASURE = 'measure',
  FORMAT_ON_SAVE_TIMEOUT_ERROR = 'formatOnSaveTimeoutError',
  FORMAT_ON_SAVE = 'formatOnSave',
}

export enum REPORT_HOST {
  BROWSER = 'browser',
  NODE = 'node',
  WORKER = 'worker',
  EXTENSION = 'extension',
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
  extra?: any;
  msg?: string;
}

export interface PerformanceData extends PointData {
  duration: number;
}

// ide-framework 调用
export const IReporterService = Symbol('IReporterService');

export interface IReporterTimer {
  timeEnd(msg?: string, extra?: any): void;
}

export interface IReporterService {
  time(name: REPORT_NAME): IReporterTimer;
  point(name: REPORT_NAME, msg?: string, extra?: any): void;
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
