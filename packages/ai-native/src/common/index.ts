import { MaybePromise } from '@opensumi/ide-core-common';

export const AiGPTBackSerivceToken = Symbol('AiGPTBackSerivceToken');
export const AiGPTBackSerivcePath = 'AiGPTBackSerivcePath';
export const AiInlineChatContentWidget = 'Ai-inline-chat-content-widget';

export const Ai_CHAT_CONTAINER_VIEW_ID = 'ai_chat';

export interface IChatMessageStructure {
  /**
   * 用于 chat 面板展示
   */
  message: string | React.ReactNode;
  /**
   * 实际调用的 prompt
   */
  prompt?: string;
}

/**
 * 指令 key
 */
export enum InstructionEnum {
  aiExplainKey = '/ Explain ',
  aiOptimzeKey = '/ Optimize ',
  aiCommentsKey = '/ Comments ',
  aiTestKey = '/ Test ',
  aiSearchKey = '/ search ',
  aiSumiKey = '/ ide ',
  aiRunKey = '/ run ',
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
  Search,
  Sumi,
  GPT,
  Explain,
  Run,
  Test,
  Optimize,
}

export type AiRunHandler = () => MaybePromise<void>;
export interface IAiRunAnswerComponentProps {
  input: string;
}

export const IAiRunFeatureRegistry = Symbol('IAiRunFeatureRegistry');

export interface IAiRunFeatureRegistry {
  /**
   * 注册 run 运行的能力
   */
  registerRun(handler: AiRunHandler): void;
  /**
   * 返回 answer 时渲染的组件
   */
  registerAnswerComponent(component: React.FC<IAiRunAnswerComponentProps>): void;

  getRuns(): AiRunHandler[];
}

export const AiNativeContribution = Symbol('AiNativeContribution');
export interface AiNativeContribution {
  /**
   * 注册 ai run 的能力
   * @param registry
   */
  registerRunFeature?(registry: IAiRunFeatureRegistry): void;
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
