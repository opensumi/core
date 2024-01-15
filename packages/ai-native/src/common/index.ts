import { CancellationToken } from '@opensumi/ide-core-common';

export * from './reporter';
export const AiBackSerivceToken = Symbol('AiBackSerivceToken');
export const AiBackSerivcePath = 'AiBackSerivcePath';

export interface IAiBackServiceOption {
  type?: string;
  model?: string;
  enableGptCache?: boolean;
}

export interface IAiCompletionOption {
  prompt: string;
  suffix?: string;
  language?: string;
  fileUrl?: string;
}

export interface IAiReportCompletionOption {
  relationId: string;

  sessionId: string;
  accept: boolean;
  repo?: string;
  completionUseTime?: number;
  renderingTime?: number;
}

export interface IAiBackServiceResponse<T = string> {
  errorCode?: number;
  errorMsg?: string;
  isCancel?: boolean;
  data?: T;
}

export interface IAiBackService<
  BaseResponse extends IAiBackServiceResponse = IAiBackServiceResponse,
  StreamResponse extends NodeJS.ReadableStream = NodeJS.ReadableStream,
  CompletionResponse = string[],
> {
  request<O extends IAiBackServiceOption>(
    input: string,
    options: O,
    cancelToken?: CancellationToken,
  ): Promise<BaseResponse>;
  requestStream<O extends IAiBackServiceOption>(
    input: string,
    options: O,
    cancelToken?: CancellationToken,
  ): Promise<StreamResponse>;
  requestCompletion<I extends IAiCompletionOption>(
    input: I,
    cancelToken?: CancellationToken,
  ): Promise<CompletionResponse>;
  reportCompletion<I extends IAiReportCompletionOption>(input: I): Promise<void>;
}

export const AiInlineChatContentWidget = 'Ai-inline-chat-content-widget';

export const Ai_CHAT_CONTAINER_VIEW_ID = 'ai_chat';
export const Ai_MENUBAR_CONTAINER_VIEW_ID = 'ai_menubar';

export interface IChatMessageStructure {
  /**
   * 用于 chat 面板展示
   */
  message: string;
  /**
   * 实际调用的 prompt
   */
  prompt?: string;
  /**
   * 数据采集上报消息类型
   */
  reportType?: string;
}

/**
 * 指令 key
 */
export enum InstructionEnum {
  aiExplainKey = '/ Explain ',
  aiOptimzeKey = '/ Optimize ',
  aiCommentsKey = '/ Comments ',
  aiTestKey = '/ Test ',
  // aiSearchDocKey = '/ SearchDoc ',
  // aiSearchCodeKey = '/ SearchCode ',
  aiSumiKey = '/ IDE ',
  aiRunKey = '/ RUN ',
}

export enum ChatCompletionRequestMessageRoleEnum {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
}
export interface ChatCompletionRequestMessage {
  /**
   * The role of the author of this message.
   * @type {string}
   * @memberof ChatCompletionRequestMessage
   */
  role: ChatCompletionRequestMessageRoleEnum;
  /**
   * The contents of the message
   * @type {string}
   * @memberof ChatCompletionRequestMessage
   */
  content: string;
  /**
   * The name of the user in a multi-user chat
   * @type {string}
   * @memberof ChatCompletionRequestMessage
   */
  name?: string;
}

export enum AISerivceType {
  SearchDoc = 'searchDoc',
  SearchCode = 'searchCode',
  Sumi = 'sumi',
  GPT = 'chat',
  Explain = 'explain',
  Run = 'run',
  Test = 'test',
  Optimize = 'optimize',
  Generate = 'generate',
  Completion = 'completion',
}

export enum AiNativeSettingSectionsId {
  INLINE_CHAT_AUTO_VISIBLE = 'inlineChat.auto.visible',
}

export const AI_NATIVE_SETTING_GROUP_ID = 'AI-Native';

export const IAiChatService = Symbol('IAiChatService');

export interface PromptOption {
  language?: string;
  useCot?: boolean;
}

export namespace AiResponseTips {
  // todo: i18n key
  export const ERROR_RESPONSE = '当前与我互动的人太多，请稍后再试，感谢您的理解与支持';

  export const STOP_IMMEDIATELY = '我先不想了，有需要可以随时问我';

  export const NOTFOUND_COMMAND = '很抱歉，暂时未找到可立即执行的命令。';

  export const NOTFOUND_COMMAND_TIP = '你可以打开命令面板搜索相关操作或者重新提问。';
}

// highlight.js/lib/index.js
export const highLightLanguageSupport = [
  '1c',
  'abnf',
  'accesslog',
  'actionscript',
  'ada',
  'angelscript',
  'apache',
  'applescript',
  'arcade',
  'arduino',
  'armasm',
  'xml',
  'asciidoc',
  'aspectj',
  'autohotkey',
  'autoit',
  'avrasm',
  'awk',
  'axapta',
  'bash',
  'basic',
  'bnf',
  'brainfuck',
  'c-like',
  'c',
  'cal',
  'capnproto',
  'ceylon',
  'clean',
  'clojure',
  'clojure-repl',
  'cmake',
  'coffeescript',
  'coq',
  'cos',
  'cpp',
  'crmsh',
  'crystal',
  'csharp',
  'csp',
  'css',
  'd',
  'markdown',
  'dart',
  'delphi',
  'diff',
  'django',
  'dns',
  'dockerfile',
  'dos',
  'dsconfig',
  'dts',
  'dust',
  'ebnf',
  'elixir',
  'elm',
  'ruby',
  'erb',
  'erlang-repl',
  'erlang',
  'excel',
  'fix',
  'flix',
  'fortran',
  'fsharp',
  'gams',
  'gauss',
  'gcode',
  'gherkin',
  'glsl',
  'gml',
  'go',
  'golo',
  'gradle',
  'groovy',
  'haml',
  'handlebars',
  'haskell',
  'haxe',
  'hsp',
  'htmlbars',
  'http',
  'hy',
  'inform7',
  'ini',
  'irpf90',
  'isbl',
  'java',
  'javascript',
  'jboss-cli',
  'json',
  'julia',
  'julia-repl',
  'kotlin',
  'lasso',
  'latex',
  'ldif',
  'leaf',
  'less',
  'lisp',
  'livecodeserver',
  'livescript',
  'llvm',
  'lsl',
  'lua',
  'makefile',
  'mathematica',
  'matlab',
  'maxima',
  'mel',
  'mercury',
  'mipsasm',
  'mizar',
  'perl',
  'mojolicious',
  'monkey',
  'moonscript',
  'n1ql',
  'nginx',
  'nim',
  'nix',
  'node-repl',
  'nsis',
  'objectivec',
  'ocaml',
  'openscad',
  'oxygene',
  'parser3',
  'pf',
  'pgsql',
  'php',
  'php-template',
  'plaintext',
  'pony',
  'powershell',
  'processing',
  'profile',
  'prolog',
  'properties',
  'protobuf',
  'puppet',
  'purebasic',
  'python',
  'python-repl',
  'q',
  'qml',
  'r',
  'reasonml',
  'rib',
  'roboconf',
  'routeros',
  'rsl',
  'ruleslanguage',
  'rust',
  'sas',
  'scala',
  'scheme',
  'scilab',
  'scss',
  'shell',
  'smali',
  'smalltalk',
  'sml',
  'sqf',
  'sql_more',
  'sql',
  'stan',
  'stata',
  'step21',
  'stylus',
  'subunit',
  'swift',
  'taggerscript',
  'yaml',
  'tap',
  'tcl',
  'thrift',
  'tp',
  'twig',
  'typescript',
  'vala',
  'vbnet',
  'vbscript',
  'vbscript-html',
  'verilog',
  'vhdl',
  'vim',
  'x86asm',
  'xl',
  'xquery',
  'zephir',
];
