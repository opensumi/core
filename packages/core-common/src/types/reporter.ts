export enum REPORT_NAME {
  ACTIVE_EXTENSION = 'activateExtension',
  RUNTIME_ERROR_EXTENSION = 'runtimeErrorExtension',
  LOAD_EXTENSION_MAIN = 'loadExtensionMain',
  PROVIDE_COMPLETION_ITEMS = 'provideCompletionItems',
  RESOLVE_COMPLETION_ITEM = 'resolveCompletionItem',
  PROVIDE_DOCUMENT_FORMATTING_EDITS = 'provideDocumentFormattingEdits',
  PROVIDE_DOCUMENT_RANGE_FORMATTING_EDITS = 'provideDocumentRangeFormattingEdits',
  EDITOR_REACTIVE = 'editorReactive',
  CHANNEL_RECONNECT = 'channelReconnect',
  MEASURE = 'measure',
  FORMAT_ON_SAVE_TIMEOUT_ERROR = 'formatOnSaveTimeoutError',
  FORMAT_ON_SAVE = 'formatOnSave',
  NOT_FOUND_COMMAND = 'notFoundCommand',
  INSTALL_EXTENSION_ERROR = 'installExtensionError',
  EXTENSION_CRASH = 'extensionCrash',
  EXTENSION_NOT_EXIST = 'extensionNotExist',
  THEME_LOAD = 'themeLoad',
  PROVIDE_HOVER = 'provideHover',
  PROVIDE_DEFINITION = 'provideDefinition',
  PROVIDE_TYPE_DEFINITION = 'provideTypeDefinition',
  PROVIDE_FOLDING_RANGES = 'provideFoldingRanges',
  PROVIDE_DOCUMENT_COLORS = 'provideDocumentColors',
  PROVIDE_COLOR_PRESENTATIONS = 'provideColorPresentations',
  PROVIDE_DOCUMENT_HIGHLIGHTS = 'provideDocumentHighlights',
  PROVIDE_LINKS = 'provideLinks',
  PROVIDE_REFERENCES = 'provideReferences',
  PROVIDE_DOCUMENT_SYMBOLS = 'provideDocumentSymbols',
  PROVIDE_IMPLEMENTATION = 'provideImplementation',
  PROVIDE_CODE_ACTIONS = 'provideCodeActions',
  PROVIDE_RENAME_EDITS = 'provideRenameEdits',
  PROVIDE_SIGNATURE_HELP = 'provideSignatureHelp',
  PROVIDE_CODE_LENSES = 'provideCodeLenses',
  RESOLVE_CODE_LENS = 'resolveCodeLens',
  PROVIDE_ON_TYPE_FORMATTING_EDITS = 'provideOnTypeFormattingEdits',
  PROVIDE_SELECTION_RANGES = 'provideSelectionRanges',
  TERMINAL_MEASURE = 'terminalMeasure',
  SEARCH_MEASURE = 'searchMeasure',
  QUICK_OPEN_MEASURE = 'quickOpenMeasure',
}

export enum REPORT_HOST {
  BROWSER = 'browser',
  NODE = 'node',
  WORKER = 'worker',
  EXTENSION = 'extension',
}

export enum REPORT_TYPE {
  PERFORMANCE = 'performance',
  POINT = 'point',
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
  timeEnd(msg?: string, extra?: any): number;
}

export interface IReporterService {
  time(name: REPORT_NAME | string): IReporterTimer;
  point(name: REPORT_NAME | string, msg?: string, extra?: any): void;
}

// 集成方实现
// 前端和后端各有一套实现
export const IReporter = Symbol('IReporter');

export interface IReporter {
  performance(name: string, data: PerformanceData): void;
  point(name: string, data: PointData): void;
}

export interface ReporterProcessMessage {
  reportType: REPORT_TYPE;
  name: string;
  data: PerformanceData | PointData;
}
