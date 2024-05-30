import { Provider } from '@opensumi/di';

import  { GeneratorRunner, IGeneratorRunner } from './generator';
import { ITerminalSuggestionRuntime, TerminalSuggestionRuntime } from './runtime';
import { ISuggestionProcessor, SuggestionProcessor } from './suggestion';
import { ITemplateRunner, TemplateRunner } from './template';

/**
 * Terminal 终端智能中，前后端通用的模块。使用时，额外实现两个平台相关的模块即可。
 * 目前 OpenSumi 标准版采用 Node.js 实现功能，前端 RPC 调用的方式。
 */
export const terminalIntellCommonDeps: Provider[] = [
  {
    token: IGeneratorRunner,
    useClass: GeneratorRunner,
  },
  {
    token: ITerminalSuggestionRuntime,
    useClass: TerminalSuggestionRuntime,
  },
  {
    token: ISuggestionProcessor,
    useClass: SuggestionProcessor,
  },
  {
    token: ITemplateRunner,
    useClass: TemplateRunner,
  },
];
