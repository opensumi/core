// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// based on https://github.com/microsoft/inshellisense/blob/ef837d4f738533da7e1a3845231bd5965e025bf1/src/runtime/suggestion.ts

// 面向对象 + DI 依赖解耦 重构

import { Autowired, Injectable } from '@opensumi/di';
import { path } from '@opensumi/ide-core-common';

import { ITerminalIntellEnvironment } from './environment';
import { IGeneratorRunner } from './generator';
import { Suggestion, SuggestionBlob } from './model';
import { CommandToken } from './parser';
import { ITemplateRunner } from './template';

type FilterStrategy = 'fuzzy' | 'prefix' | 'default';

enum SuggestionIcons {
  File = '📄',
  Folder = '📁',
  Subcommand = '📦',
  Option = '🔗',
  Argument = '💲',
  Mixin = '🏝️',
  Shortcut = '🔥',
  Special = '⭐',
  Default = '📀',
}

export const ISuggestionProcessor = Symbol('TokenSuggestionProcessor');

export interface ISuggestionProcessor {
  getSubcommandDrivenRecommendation(
    subcommand: Fig.Subcommand,
    persistentOptions: Fig.Option[],
    partialToken: CommandToken | undefined,
    argsDepleted: boolean,
    argsFromSubcommand: boolean,
    acceptedTokens: CommandToken[],
    cwd: string,
  ): Promise<SuggestionBlob | undefined>;
  getArgDrivenRecommendation(
    args: Fig.Arg[],
    subcommand: Fig.Subcommand,
    persistentOptions: Fig.Option[],
    partialToken: CommandToken | undefined,
    acceptedTokens: CommandToken[],
    variadicArgBound: boolean,
    cwd: string,
  ): Promise<SuggestionBlob | undefined>;
}

@Injectable()
export class SuggestionProcessor implements ISuggestionProcessor {
  @Autowired(ITemplateRunner)
  protected readonly templateRunner: ITemplateRunner;

  @Autowired(IGeneratorRunner)
  protected readonly generatorRunner: IGeneratorRunner;

  @Autowired(ITerminalIntellEnvironment)
  protected readonly terminalIntellEnv: ITerminalIntellEnvironment;

  private getIcon(icon: string | undefined, suggestionType: Fig.SuggestionType | undefined): string {
    // TODO: enable fig icons once spacing is better
    // if (icon && /[^\u0000-\u00ff]/.test(icon)) {
    //   return icon;
    // }
    switch (suggestionType) {
      case 'arg':
        return SuggestionIcons.Argument;
      case 'file':
        return SuggestionIcons.File;
      case 'folder':
        return SuggestionIcons.Folder;
      case 'option':
        return SuggestionIcons.Option;
      case 'subcommand':
        return SuggestionIcons.Subcommand;
      case 'mixin':
        return SuggestionIcons.Mixin;
      case 'shortcut':
        return SuggestionIcons.Shortcut;
      case 'special':
        return SuggestionIcons.Special;
    }
    return SuggestionIcons.Default;
  }

  private getLong(suggestion: Fig.SingleOrArray<string>): string {
    return suggestion instanceof Array ? suggestion.reduce((p, c) => (p.length > c.length ? p : c)) : suggestion;
  }

  private getPathy(type: Fig.SuggestionType | undefined): boolean {
    return type === 'file' || type === 'folder';
  }

  private toSuggestion(suggestion: Fig.Suggestion, name?: string, type?: Fig.SuggestionType): Suggestion | undefined {
    if (suggestion.name == null) {
      return;
    }
    return {
      name: name ?? this.getLong(suggestion.name),
      description: suggestion.description,
      icon: this.getIcon(suggestion.icon, type ?? suggestion.type),
      allNames: suggestion.name instanceof Array ? suggestion.name : [suggestion.name],
      priority: suggestion.priority ?? 50,
      insertValue: suggestion.insertValue,
      pathy: this.getPathy(suggestion.type),
    };
  }

  private filter<
    T extends Fig.BaseSuggestion & { name?: Fig.SingleOrArray<string>; type?: Fig.SuggestionType | undefined },
  >(
    suggestions: T[],
    filterStrategy: FilterStrategy | undefined,
    partialCmd: string | undefined,
    suggestionType: Fig.SuggestionType | undefined,
  ): Suggestion[] {
    if (!partialCmd) {
      return suggestions
        .map((s) => this.toSuggestion(s, undefined, suggestionType))
        .filter((s) => s != null) as Suggestion[];
    }

    switch (filterStrategy) {
      case 'fuzzy':
        return suggestions
          .map((s) => {
            if (s.name == null) {
              return;
            }
            if (s.name instanceof Array) {
              const matchedName = s.name.find((n) => n.toLowerCase().includes(partialCmd.toLowerCase()));
              return matchedName != null
                ? {
                    name: matchedName,
                    description: s.description,
                    icon: this.getIcon(s.icon, s.type ?? suggestionType),
                    allNames: s.name,
                    priority: s.priority ?? 50,
                    insertValue: s.insertValue,
                    pathy: this.getPathy(s.type),
                  }
                : undefined;
            }
            return s.name.toLowerCase().includes(partialCmd.toLowerCase())
              ? {
                  name: s.name,
                  description: s.description,
                  icon: this.getIcon(s.icon, s.type ?? suggestionType),
                  allNames: [s.name],
                  priority: s.priority ?? 50,
                  insertValue: s.insertValue,
                  pathy: this.getPathy(s.type),
                }
              : undefined;
          })
          .filter((s) => s != null) as Suggestion[];
      default:
        return suggestions
          .map((s) => {
            if (s.name == null) {
              return;
            }
            if (s.name instanceof Array) {
              const matchedName = s.name.find((n) => n.toLowerCase().startsWith(partialCmd.toLowerCase()));
              return matchedName != null
                ? {
                    name: matchedName,
                    description: s.description,
                    icon: this.getIcon(s.icon, s.type ?? suggestionType),
                    allNames: s.name,
                    insertValue: s.insertValue,
                    priority: s.priority ?? 50,
                    pathy: this.getPathy(s.type),
                  }
                : undefined;
            }
            return s.name.toLowerCase().startsWith(partialCmd.toLowerCase())
              ? {
                  name: s.name,
                  description: s.description,
                  icon: this.getIcon(s.icon, s.type ?? suggestionType),
                  allNames: [s.name],
                  insertValue: s.insertValue,
                  priority: s.priority ?? 50,
                  pathy: this.getPathy(s.type),
                }
              : undefined;
          })
          .filter((s) => s != null) as Suggestion[];
    }
  }

  private getEscapedPath(value?: string): string | undefined {
    return value?.replaceAll(' ', '\\ ');
  }

  private adjustPathSuggestions(suggestions: Suggestion[], partialToken?: CommandToken): Suggestion[] {
    if (partialToken == null || partialToken.isQuoted) {
      return suggestions;
    }
    return suggestions.map((s) =>
      s.pathy
        ? {
            ...s,
            insertValue: this.getEscapedPath(s.insertValue),
            name: s.insertValue == null ? this.getEscapedPath(s.name)! : s.name,
          }
        : s,
    );
  }

  private removeAcceptedSuggestions(suggestions: Suggestion[], acceptedTokens: CommandToken[]): Suggestion[] {
    const seen = new Set<string>(acceptedTokens.map((t) => t.token));
    return suggestions.filter((s) => s.allNames.every((n) => !seen.has(n)));
  }

  private removeDuplicateSuggestion(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    return suggestions
      .map((s) => {
        if (seen.has(s.name)) {
          return null;
        }
        seen.add(s.name);
        return s;
      })
      .filter((s): s is Suggestion => s != null);
  }

  private removeEmptySuggestion(suggestions: Suggestion[]): Suggestion[] {
    return suggestions.filter((s) => s.name.length > 0);
  }

  // 使用 generator 生成的函数，这种情况下是需要 Node.js/  Runtime 的
  public async generatorSuggestions(
    generator: Fig.SingleOrArray<Fig.Generator> | undefined,
    acceptedTokens: CommandToken[],
    filterStrategy: FilterStrategy | undefined,
    partialCmd: string | undefined,
    cwd: string,
  ): Promise<Suggestion[]> {
    const generators = generator instanceof Array ? generator : generator ? [generator] : [];
    const tokens = acceptedTokens.map((t) => t.token);
    if (partialCmd) {
      tokens.push(partialCmd);
    }
    const suggestions = (
      await Promise.all(generators.map((gen) => this.generatorRunner.runGenerator(gen, tokens, cwd)))
    ).flat();
    return this.filter<Fig.Suggestion>(
      suggestions.map((suggestion) => ({ ...suggestion, priority: suggestion.priority ?? 60 })),
      filterStrategy,
      partialCmd,
      undefined,
    );
  }

  public async templateSuggestions(
    templates: Fig.Template | undefined,
    filterStrategy: FilterStrategy | undefined,
    partialCmd: string | undefined,
    cwd: string,
  ): Promise<Suggestion[]> {
    return this.filter<Fig.Suggestion>(
      await this.templateRunner.runTemplates(templates ?? [], cwd),
      filterStrategy,
      partialCmd,
      undefined,
    );
  }

  public suggestionSuggestions(
    suggestions: (string | Fig.Suggestion)[] | undefined,
    filterStrategy: FilterStrategy | undefined,
    partialCmd: string | undefined,
  ): Suggestion[] {
    const cleanedSuggestions = suggestions?.map((s) => (typeof s === 'string' ? { name: s } : s)) ?? [];
    return this.filter<Fig.Suggestion>(cleanedSuggestions ?? [], filterStrategy, partialCmd, undefined);
  }

  public subcommandSuggestions(
    subcommands: Fig.Subcommand[] | undefined,
    filterStrategy: FilterStrategy | undefined,
    partialCmd: string | undefined,
  ): Suggestion[] {
    return this.filter<Fig.Subcommand>(subcommands ?? [], filterStrategy, partialCmd, 'subcommand');
  }

  public optionSuggestions(
    options: Fig.Option[] | undefined,
    acceptedTokens: CommandToken[],
    filterStrategy: FilterStrategy | undefined,
    partialCmd: string | undefined,
  ): Suggestion[] {
    const usedOptions = new Set(acceptedTokens.filter((t) => t.isOption).map((t) => t.token));
    const validOptions = options?.filter(
      (o) => o.exclusiveOn?.every((exclusiveOption) => !usedOptions.has(exclusiveOption)) ?? true,
    );
    return this.filter<Fig.Option>(validOptions ?? [], filterStrategy, partialCmd, 'option');
  }

  public async getSubcommandDrivenRecommendation(
    subcommand: Fig.Subcommand,
    persistentOptions: Fig.Option[],
    partialToken: CommandToken | undefined,
    argsDepleted: boolean,
    argsFromSubcommand: boolean,
    acceptedTokens: CommandToken[],
    cwd: string,
  ): Promise<SuggestionBlob | undefined> {
    this.terminalIntellEnv.getLogger().debug({
      msg: 'suggestion point',
      subcommandShorten: JSON.stringify(subcommand).substring(0, 400),
      persistentOptions,
      partialToken,
      argsDepleted,
      argsFromSubcommand,
      acceptedTokens,
      cwd,
    });
    if (argsDepleted && argsFromSubcommand) {
      return;
    }
    let partialCmd = partialToken?.token;
    if (partialToken?.isPath) {
      partialCmd = partialToken.isPathComplete ? '' : path.basename(partialCmd ?? '');
    }

    const suggestions: Suggestion[] = [];
    const argLength = subcommand.args instanceof Array ? subcommand.args.length : subcommand.args ? 1 : 0;
    const allOptions = persistentOptions.concat(subcommand.options ?? []);

    if (!argsFromSubcommand) {
      suggestions.push(...this.subcommandSuggestions(subcommand.subcommands, subcommand.filterStrategy, partialCmd));
      suggestions.push(...this.optionSuggestions(allOptions, acceptedTokens, subcommand.filterStrategy, partialCmd));
    }
    if (argLength !== 0) {
      const activeArg = subcommand.args instanceof Array ? subcommand.args[0] : subcommand.args;
      suggestions.push(
        ...(await this.generatorSuggestions(
          activeArg?.generators,
          acceptedTokens,
          activeArg?.filterStrategy,
          partialCmd,
          cwd,
        )),
      );
      suggestions.push(...this.suggestionSuggestions(activeArg?.suggestions, activeArg?.filterStrategy, partialCmd));
      suggestions.push(
        ...(await this.templateSuggestions(activeArg?.template, activeArg?.filterStrategy, partialCmd, cwd)),
      );
    }

    return {
      suggestions: this.removeDuplicateSuggestion(
        this.removeEmptySuggestion(
          this.removeAcceptedSuggestions(
            this.adjustPathSuggestions(
              suggestions.sort((a, b) => b.priority - a.priority),
              partialToken,
            ),
            acceptedTokens,
          ),
        ),
      ),
    };
  }

  public async getArgDrivenRecommendation(
    args: Fig.Arg[],
    subcommand: Fig.Subcommand,
    persistentOptions: Fig.Option[],
    partialToken: CommandToken | undefined,
    acceptedTokens: CommandToken[],
    variadicArgBound: boolean,
    cwd: string,
  ): Promise<SuggestionBlob | undefined> {
    let partialCmd = partialToken?.token;
    if (partialToken?.isPath) {
      partialCmd = partialToken.isPathComplete ? '' : path.basename(partialCmd ?? '');
    }

    const activeArg = args[0];
    const allOptions = persistentOptions.concat(subcommand.options ?? []);
    const suggestions = [
      ...(await this.generatorSuggestions(
        args[0].generators,
        acceptedTokens,
        activeArg?.filterStrategy,
        partialCmd,
        cwd,
      )),
      ...this.suggestionSuggestions(args[0].suggestions, activeArg?.filterStrategy, partialCmd),
      ...(await this.templateSuggestions(args[0].template, activeArg?.filterStrategy, partialCmd, cwd)),
    ];

    if (activeArg.isOptional || (activeArg.isVariadic && variadicArgBound)) {
      suggestions.push(...this.subcommandSuggestions(subcommand.subcommands, activeArg?.filterStrategy, partialCmd));
      suggestions.push(...this.optionSuggestions(allOptions, acceptedTokens, activeArg?.filterStrategy, partialCmd));
    }

    return {
      suggestions: this.removeDuplicateSuggestion(
        this.removeEmptySuggestion(
          this.removeAcceptedSuggestions(
            this.adjustPathSuggestions(
              suggestions.sort((a, b) => b.priority - a.priority),
              partialToken,
            ),
            acceptedTokens,
          ),
        ),
      ),
      argumentDescription: activeArg.description ?? activeArg.name,
    };
  }
}
