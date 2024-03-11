export const AIInlineChatContentWidget = 'AI-inline-chat-content-widget';

export const IAINativeService = Symbol('IAINativeService');
import { CancellationToken, Event, FileType, IDisposable, IMarkdownString, Uri } from '@opensumi/ide-core-common';

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
  /*
   * agent id
   */
  agentId?: string;
  /**
   * slash command
   */
  command?: string;
  /**
   * 是否立即发送，默认为 true
   */
  immediate?: boolean;
}

/**
 * 指令 key
 */
export enum InstructionEnum {
  aiExplainKey = '/ Explain ',
  aiOptimzeKey = '/ Optimize ',
  aiCommentsKey = '/ Comments ',
  aiTestKey = '/ Test ',
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
  Sumi = 'sumi',
  GPT = 'chat',
  Explain = 'explain',
  Run = 'run',
  Test = 'test',
  Optimize = 'optimize',
  Generate = 'generate',
  Completion = 'completion',
  Agent = 'agent',
}

export const IAiChatService = Symbol('IAiChatService');

export interface PromptOption {
  language?: string;
  useCot?: boolean;
}

export namespace AiResponseTips {
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

export const IChatManagerService = Symbol('IChatManagerService');

export const IChatAgentService = Symbol('IChatAgentService');

export interface IChatAgentService {
  readonly onDidChangeAgents: Event<void>;
  readonly onDidSendMessage: Event<IChatContent>;
  registerAgent(agent: IChatAgent): IDisposable;
  invokeAgent(
    id: string,
    request: IChatAgentRequest,
    progress: (part: IChatProgress) => void,
    history: IChatMessage[],
    token: CancellationToken,
  ): Promise<IChatAgentResult>;
  getAgents(): Array<IChatAgent>;
  getAgent(id: string): IChatAgent | undefined;
  hasAgent(id: string): boolean;
  updateAgent(id: string, updateMetadata: IChatAgentMetadata): void;
  populateChatInput(id: string, message: IChatMessageStructure): void;
  getCommands(): Array<IChatAgentCommand & { agentId: string }>;
  parseMessage(value: string, currentAgentId?: string): { agentId: string; command: string; message: string };
  getFollowups(id: string, sessionId: string, token: CancellationToken): Promise<IChatFollowup[]>;
  getSampleQuestions(id: string, token: CancellationToken): Promise<IChatFollowup[]>;
  getAllSampleQuestions(): Promise<IChatReplyFollowup[]>;
  sendMessage(chunk: IChatContent): void;
}

export interface IChatAgent extends IChatAgentData {
  invoke(
    request: IChatAgentRequest,
    progress: (part: IChatProgress) => void,
    history: IChatMessage[],
    token: CancellationToken,
  ): Promise<IChatAgentResult>;
  provideFollowups?(sessionId: string, token: CancellationToken): Promise<IChatFollowup[]>;
  provideSlashCommands(token: CancellationToken): Promise<IChatAgentCommand[]>;
  provideSampleQuestions?(token: CancellationToken): Promise<IChatReplyFollowup[]>;
}

export interface IChatAgentData {
  id: string;
  metadata: IChatAgentMetadata;
}

export interface IChatAgentMetadata {
  description?: string;
  isDefault?: boolean;
  fullName?: string;
  icon?: Uri;
  iconDark?: Uri;
}

export interface IChatAgentRequest {
  sessionId: string;
  requestId: string;
  command?: string;
  message: string;
  regenerate?: boolean;
}

export const enum ChatMessageRole {
  System,
  User,
  Assistant,
  Function,
}

export interface IChatMessage {
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly name?: string;
}

export interface IChatContent {
  content: string;
  kind: 'content';
}

export interface IChatMarkdownContent {
  content: IMarkdownString;
  kind: 'markdownContent';
}

export interface IChatAsyncContent {
  content: string;
  resolvedContent: Promise<string | IMarkdownString | IChatTreeData>;
  kind: 'asyncContent';
}

export interface IChatProgressMessage {
  content: string;
  kind: 'progressMessage';
}

export interface IChatResponseProgressFileTreeData {
  label: string;
  uri: Uri;
  type?: FileType;
  children?: IChatResponseProgressFileTreeData[];
}

export interface IChatTreeData {
  treeData: IChatResponseProgressFileTreeData;
  kind: 'treeData';
}

export interface IChatComponent {
  component: string;
  value?: unknown;
  kind: 'component';
}

export type IChatProgress = IChatContent | IChatMarkdownContent | IChatAsyncContent | IChatTreeData | IChatComponent;

export interface IChatResponseErrorDetails {
  message: string;
}

export interface IChatAgentResult {
  errorDetails?: IChatResponseErrorDetails;
}

export interface IChatAgentCommand {
  name: string;
  description: string;
}

export interface IChatReplyFollowup {
  kind: 'reply';
  message: string;
  title?: string;
  tooltip?: string;
}

export interface IChatResponseCommandFollowup {
  kind: 'command';
  commandId: string;
  args?: any[];
  title: string;
  when?: string;
}

export type IChatFollowup = IChatReplyFollowup | IChatResponseCommandFollowup;

export interface IChatMessage {
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly name?: string;
}

export interface IChatRequestMessage {
  prompt: string;
  agentId: string;
  command?: string;
}

export interface IChatRequestModel {
  readonly requestId: string;
  session: IChatModel;
  message: IChatRequestMessage;
  response: IChatResponseModel;
}

export interface IChatResponseModel {
  readonly requestId: string;
  session: IChatModel;
}

export interface IChatModel {
  readonly requests: IChatRequestModel[];
}
