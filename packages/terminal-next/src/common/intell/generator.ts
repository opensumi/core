// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// 对源文件额外进行了面向对象 + 依赖注入的修改和优化，使其脱离 Node.js/Browser 单一环境的限制
// GeneratorRunner 类,负责对于 Fig Generator 的处理

import { Autowired, Injectable } from '@opensumi/di';

import { ITerminalIntellEnvironment } from './environment';
import { ITemplateRunner } from './template';

export interface IGeneratorRunner {
  runGenerator(generator: Fig.Generator, tokens: string[], cwd: string): Promise<Fig.Suggestion[]>;
}

export const IGeneratorRunner = Symbol('IGeneratorRunner');

@Injectable()
export class GeneratorRunner implements IGeneratorRunner {
  @Autowired(ITerminalIntellEnvironment)
  protected readonly terminalIntellEnv: ITerminalIntellEnvironment;

  @Autowired(ITemplateRunner)
  protected readonly templateRunner: ITemplateRunner;

  private getGeneratorContext(cwd: string, env: Record<string, string | undefined>): Fig.GeneratorContext {
    return {
      environmentVariables: Object.fromEntries(
        Object.entries(env).filter((entry): entry is [string, string] => entry[1] != null),
      ),
      currentWorkingDirectory: cwd,
      currentProcess: '', // TODO: define current process
      sshPrefix: '', // deprecated, should be empty
      isDangerous: false,
      searchTerm: '', // TODO: define search term
    };
  }

  public async runGenerator(generator: Fig.Generator, tokens: string[], cwd: string): Promise<Fig.Suggestion[]> {
    const { script, postProcess, scriptTimeout, splitOn, custom, template, filterTemplateSuggestions } = generator;

    const executeShellCommand = this.terminalIntellEnv.buildExecuteShellCommand(scriptTimeout ?? 5000);
    const suggestions: Fig.Suggestion[] = [];
    try {
      if (script) {
        const shellInput = typeof script === 'function' ? script(tokens) : script;
        const scriptOutput = Array.isArray(shellInput)
          ? await executeShellCommand({ command: shellInput.at(0) ?? '', args: shellInput.slice(1), cwd })
          : await executeShellCommand({ ...shellInput, cwd });

        const scriptStdout = scriptOutput.stdout.trim();
        if (postProcess) {
          suggestions.push(...postProcess(scriptStdout, tokens));
        } else if (splitOn) {
          suggestions.push(...scriptStdout.split(splitOn).map((s) => ({ name: s })));
        }
      }

      if (custom) {
        const env = await this.terminalIntellEnv.getEnv();
        suggestions.push(...(await custom(tokens, executeShellCommand, this.getGeneratorContext(cwd, env))));
      }

      if (template != null) {
        const templateSuggestions = await this.templateRunner.runTemplates(template, cwd);
        if (filterTemplateSuggestions) {
          suggestions.push(...filterTemplateSuggestions(templateSuggestions));
        } else {
          suggestions.push(...templateSuggestions);
        }
      }
      return suggestions;
    } catch (e) {
      const err = typeof e === 'string' ? e : e instanceof Error ? e.message : e;
      this.terminalIntellEnv.getLogger().debug({ msg: 'generator failed', err, script, splitOn, template });
    }
    return suggestions;
  }
}

export default GeneratorRunner;
