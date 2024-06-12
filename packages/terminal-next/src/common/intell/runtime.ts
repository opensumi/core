// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// SpecLoader 是加载 Fig Spec 的抽象层，

import { Autowired, Injectable } from '@opensumi/di';
import { path } from '@opensumi/ide-core-common';

import { ITerminalIntellEnvironment, Shell } from './environment';
import { SuggestionBlob } from './model';
import { CommandToken, parseCommand } from './parser';
import { ISuggestionProcessor } from './suggestion';

export const IFigSpecLoader = Symbol('IFigSpecLoader');

// SpecLoader 用于加载 Fig 的 Specs
export interface IFigSpecLoader {
  loadSpec(cmd: CommandToken[]): Promise<Fig.Spec | undefined>;
  lazyLoadSpec(key: string): Promise<Fig.Spec | undefined>;
  lazyLoadSpecLocation(location: Fig.SpecLocation): Promise<Fig.Spec | undefined>;
  getSpecSet(): any;
}

/**
 * 标准 Terminal Suggestion 接口
 */
export interface ITerminalSuggestionProvider {
  getSuggestions(cmd: string, cwd: string): Promise<SuggestionBlob | undefined>;
}

export const ITerminalSuggestionProviderPath = 'ITerminalSuggestionProviderPath';
export const ITerminalSuggestionRuntime = Symbol('ITerminalSuggestionRuntime');

/**
 * TerminalSuggestionRuntime 负责提供给 Terminal 前端 Decoration 的 Suggestion 数据
 */
@Injectable()
export class TerminalSuggestionRuntime implements ITerminalSuggestionProvider {
  @Autowired(IFigSpecLoader)
  private specLoader: IFigSpecLoader;

  @Autowired(ISuggestionProcessor)
  private suggestionProcessor: ISuggestionProcessor;

  @Autowired(ITerminalIntellEnvironment)
  private terminalIntellEnvironment: ITerminalIntellEnvironment;

  public async getSuggestions(cmd: string, cwd: string): Promise<SuggestionBlob | undefined> {
    const activeCmd = parseCommand(cmd);
    const rootToken = activeCmd.at(0);
    if (activeCmd.length === 0 || !rootToken?.complete) {
      return;
    }

    const spec = await this.specLoader.loadSpec(activeCmd);
    if (spec == null) {
      return;
    }
    const subcommand = this.getSubcommand(spec);
    if (subcommand == null) {
      return;
    }

    const lastCommand = activeCmd.at(-1);
    const {
      cwd: resolvedCwd,
      pathy,
      complete: pathyComplete,
    } = await this.terminalIntellEnvironment.resolveCwd(lastCommand, cwd, Shell.Bash);
    if (pathy && lastCommand) {
      lastCommand.isPath = true;
      lastCommand.isPathComplete = pathyComplete;
    }
    const result = await this.runSubcommand(activeCmd.slice(1), subcommand, resolvedCwd);
    if (result == null) {
      return;
    }

    // TODO 目前只是粗暴的限制了返回 100 条终端补全数据，后面看看有没有更好的方案
    result.suggestions = result.suggestions.slice(0, 100);

    let charactersToDrop = lastCommand?.complete ? 0 : lastCommand?.token.length ?? 0;
    if (pathy) {
      charactersToDrop = pathyComplete ? 0 : path.basename(lastCommand?.token ?? '').length;
    }
    return { ...result, charactersToDrop };
  }

  public getSpecNames(): string[] {
    return Object.keys(this.specLoader.getSpecSet()).filter((spec) => !spec.startsWith('@') && spec !== '-');
  }

  private getPersistentOptions(persistentOptions: Fig.Option[], options?: Fig.Option[]): Fig.Option[] {
    const persistentOptionNames = new Set(
      persistentOptions.map((o) => (typeof o.name === 'string' ? [o.name] : o.name)).flat(),
    );
    return persistentOptions.concat(
      (options ?? []).filter(
        (o) =>
          (typeof o.name == 'string'
            ? !persistentOptionNames.has(o.name)
            : o.name.some((n) => !persistentOptionNames.has(n))) && o.isPersistent === true,
      ),
    );
  }

  private getSubcommand(spec?: Fig.Spec): Fig.Subcommand | undefined {
    if (spec == null) {
      return;
    }
    if (typeof spec === 'function') {
      const potentialSubcommand = spec();
      if (Object.prototype.hasOwnProperty.call(potentialSubcommand, 'name')) {
        return potentialSubcommand as Fig.Subcommand;
      }
      return;
    }
    return spec;
  }

  get executeShellCommand() {
    return this.terminalIntellEnvironment.buildExecuteShellCommand(5000);
  }

  private async genSubcommand(command: string, parentCommand: Fig.Subcommand): Promise<Fig.Subcommand | undefined> {
    if (!parentCommand.subcommands || parentCommand.subcommands.length === 0) {
      return;
    }

    const subcommandIdx = parentCommand.subcommands.findIndex((s) =>
      Array.isArray(s.name) ? s.name.includes(command) : s.name === command,
    );

    if (subcommandIdx === -1) {
      return;
    }
    const subcommand = parentCommand.subcommands[subcommandIdx];

    switch (typeof subcommand.loadSpec) {
      case 'function': {
        const partSpec = await subcommand.loadSpec(command, this.executeShellCommand);
        if (partSpec instanceof Array) {
          const locationSpecs = (
            await Promise.all(partSpec.map((s) => this.specLoader.lazyLoadSpecLocation(s)))
          ).filter((s) => s != null) as Fig.Spec[];
          const subcommands = locationSpecs
            .map((s) => this.getSubcommand(s))
            .filter((s) => s != null) as Fig.Subcommand[];
          (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = {
            ...subcommand,
            ...(subcommands.find((s) => s?.name === command) ?? []),
            loadSpec: undefined,
          };
          return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
        } else if (Object.prototype.hasOwnProperty.call(partSpec, 'type')) {
          const locationSingleSpec = await this.specLoader.lazyLoadSpecLocation(partSpec as Fig.SpecLocation);
          (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = {
            ...subcommand,
            ...(this.getSubcommand(locationSingleSpec) ?? []),
            loadSpec: undefined,
          };
          return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
        } else {
          (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = {
            ...subcommand,
            ...partSpec,
            loadSpec: undefined,
          };
          return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
        }
      }
      case 'string': {
        const spec = await this.specLoader.lazyLoadSpec(subcommand.loadSpec as string);
        (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = {
          ...subcommand,
          ...(this.getSubcommand(spec) ?? []),
          loadSpec: undefined,
        };
        return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
      }
      case 'object': {
        (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = {
          ...subcommand,
          ...(subcommand.loadSpec ?? {}),
          loadSpec: undefined,
        };
        return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
      }
      case 'undefined': {
        return subcommand;
      }
    }
  }

  private getOption(activeToken: CommandToken, options: Fig.Option[]): Fig.Option | undefined {
    return options.find((o) =>
      typeof o.name === 'string' ? o.name === activeToken.token : o.name.includes(activeToken.token),
    );
  }

  private getPersistentTokens(tokens: CommandToken[]): CommandToken[] {
    return tokens.filter((t) => t.isPersistent === true);
  }

  private getArgs(args: Fig.SingleOrArray<Fig.Arg> | undefined): Fig.Arg[] {
    return args instanceof Array ? args : args != null ? [args] : [];
  }

  private async runOption(
    tokens: CommandToken[],
    option: Fig.Option,
    subcommand: Fig.Subcommand,
    cwd: string,
    persistentOptions: Fig.Option[],
    acceptedTokens: CommandToken[],
  ): Promise<SuggestionBlob | undefined> {
    if (tokens.length === 0) {
      throw new Error('invalid state reached, option expected but no tokens found');
    }
    const activeToken = tokens[0];
    const isPersistent = persistentOptions.some((o) =>
      typeof o.name === 'string' ? o.name === activeToken.token : o.name.includes(activeToken.token),
    );
    if ((option.args instanceof Array && option.args.length > 0) || option.args != null) {
      const args = option.args instanceof Array ? option.args : [option.args];
      return this.runArg(
        tokens.slice(1),
        args,
        subcommand,
        cwd,
        persistentOptions,
        acceptedTokens.concat(activeToken),
        true,
        false,
      );
    }
    return this.runSubcommand(
      tokens.slice(1),
      subcommand,
      cwd,
      persistentOptions,
      acceptedTokens.concat({
        ...activeToken,
        isPersistent,
      }),
    );
  }

  private async runArg(
    tokens: CommandToken[],
    args: Fig.Arg[],
    subcommand: Fig.Subcommand,
    cwd: string,
    persistentOptions: Fig.Option[],
    acceptedTokens: CommandToken[],
    fromOption: boolean,
    fromVariadic: boolean,
  ): Promise<SuggestionBlob | undefined> {
    if (args.length === 0) {
      return this.runSubcommand(tokens, subcommand, cwd, persistentOptions, acceptedTokens, true, !fromOption);
    } else if (tokens.length === 0) {
      return await this.getArgDrivenRecommendation(
        args,
        subcommand,
        persistentOptions,
        undefined,
        acceptedTokens,
        fromVariadic,
        cwd,
      );
    } else if (!tokens.at(0)?.complete) {
      return await this.getArgDrivenRecommendation(
        args,
        subcommand,
        persistentOptions,
        tokens[0],
        acceptedTokens,
        fromVariadic,
        cwd,
      );
    }

    const activeToken = tokens[0];
    if (args.every((a) => a.isOptional)) {
      if (activeToken.isOption) {
        const option = this.getOption(activeToken, persistentOptions.concat(subcommand.options ?? []));
        if (option != null) {
          return this.runOption(tokens, option, subcommand, cwd, persistentOptions, acceptedTokens);
        }
        return;
      }

      const nextSubcommand = await this.genSubcommand(activeToken.token, subcommand);
      if (nextSubcommand != null) {
        return this.runSubcommand(
          tokens.slice(1),
          nextSubcommand,
          cwd,
          persistentOptions,
          this.getPersistentTokens(acceptedTokens.concat(activeToken)),
        );
      }
    }

    const activeArg = args[0];
    if (activeArg.isVariadic) {
      return this.runArg(
        tokens.slice(1),
        args,
        subcommand,
        cwd,
        persistentOptions,
        acceptedTokens.concat(activeToken),
        fromOption,
        true,
      );
    } else if (activeArg.isCommand) {
      if (tokens.length <= 0) {
        return;
      }
      const spec = await this.specLoader.loadSpec(tokens);
      if (spec == null) {
        return;
      }
      const subcommand = this.getSubcommand(spec);
      if (subcommand == null) {
        return;
      }
      return this.runSubcommand(tokens.slice(1), subcommand, cwd);
    }
    return this.runArg(
      tokens.slice(1),
      args.slice(1),
      subcommand,
      cwd,
      persistentOptions,
      acceptedTokens.concat(activeToken),
      fromOption,
      false,
    );
  }

  private async runSubcommand(
    tokens: CommandToken[],
    subcommand: Fig.Subcommand,
    cwd: string,
    persistentOptions: Fig.Option[] = [],
    acceptedTokens: CommandToken[] = [],
    argsDepleted = false,
    argsUsed = false,
  ): Promise<SuggestionBlob | undefined> {
    if (tokens.length === 0) {
      return this.getSubcommandDrivenRecommendation(
        subcommand,
        persistentOptions,
        undefined,
        argsDepleted,
        argsUsed,
        acceptedTokens,
        cwd,
      );
    } else if (!tokens.at(0)?.complete) {
      return this.getSubcommandDrivenRecommendation(
        subcommand,
        persistentOptions,
        tokens[0],
        argsDepleted,
        argsUsed,
        acceptedTokens,
        cwd,
      );
    }

    const activeToken = tokens[0];
    const activeArgsLength = subcommand.args instanceof Array ? subcommand.args.length : 1;
    const allOptions = [...persistentOptions, ...(subcommand.options ?? [])];

    if (activeToken.isOption) {
      const option = this.getOption(activeToken, allOptions);
      if (option != null) {
        return this.runOption(tokens, option, subcommand, cwd, persistentOptions, acceptedTokens);
      }
      return;
    }

    const nextSubcommand = await this.genSubcommand(activeToken.token, subcommand);
    if (nextSubcommand != null) {
      return this.runSubcommand(
        tokens.slice(1),
        nextSubcommand,
        cwd,
        this.getPersistentOptions(persistentOptions, subcommand.options),
        this.getPersistentTokens(acceptedTokens.concat(activeToken)),
      );
    }

    if (activeArgsLength <= 0) {
      return;
    }

    const args = this.getArgs(subcommand.args);
    if (args.length !== 0) {
      return this.runArg(tokens, args, subcommand, cwd, allOptions, acceptedTokens, false, false);
    }
    return this.runSubcommand(tokens.slice(1), subcommand, cwd, persistentOptions, acceptedTokens.concat(activeToken));
  }

  private async getSubcommandDrivenRecommendation(
    subcommand: Fig.Subcommand,
    persistentOptions: Fig.Option[],
    token: CommandToken | undefined,
    argsDepleted: boolean,
    argsUsed: boolean,
    acceptedTokens: CommandToken[],
    cwd: string,
  ): Promise<SuggestionBlob | undefined> {
    return this.suggestionProcessor.getSubcommandDrivenRecommendation(
      subcommand,
      persistentOptions,
      token,
      argsDepleted,
      argsUsed,
      acceptedTokens,
      cwd,
    );
  }

  private async getArgDrivenRecommendation(
    args: Fig.Arg[],
    subcommand: Fig.Subcommand,
    persistentOptions: Fig.Option[],
    token: CommandToken | undefined,
    acceptedTokens: CommandToken[],
    fromVariadic: boolean,
    cwd: string,
  ): Promise<SuggestionBlob | undefined> {
    return this.suggestionProcessor.getArgDrivenRecommendation(
      args,
      subcommand,
      persistentOptions,
      token,
      acceptedTokens,
      fromVariadic,
      cwd,
    );
  }
}
