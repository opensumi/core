import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  getDebugLogger,
  revive,
  toDisposable,
  DisposableStore,
  isNonEmptyArray,
  IExtensionInfo,
} from '@opensumi/ide-core-common';
import { Uri } from '@opensumi/ide-core-common';
import { cloneAndChange } from '@opensumi/ide-core-common/lib/utils/objects';
import { validateConstraint, isFunction } from '@opensumi/ide-core-common/lib/utils/types';

import {
  MainThreadAPIIdentifier,
  IMainThreadCommands,
  IExtHostCommands,
  Handler,
  ArgumentProcessor,
  ICommandHandlerDescription,
  CommandHandler,
  IExtensionDescription,
} from '../../../common/vscode';
import * as extHostTypeConverter from '../../../common/vscode/converter';
import { Disposable, Position, Range, Location } from '../../../common/vscode/ext-types';
import * as modes from '../../../common/vscode/model.api';
import { CommandDto } from '../../../common/vscode/scm';
import { IBuiltInCommand } from '../../ext.process-base';

import { ExtensionHostEditorService } from './editor/editor.host';
import { ApiCommand, ApiCommandResult, newCommands } from './ext.host.api.command';
import { ObjectIdentifier } from './language/util';

export function createCommandsApiFactory(
  extHostCommands: IExtHostCommands,
  extHostEditors: ExtensionHostEditorService,
  extension: IExtensionDescription,
) {
  const commands: typeof vscode.commands = {
    registerCommand(id: string, command: <T>(...args: any[]) => T | Promise<T>, thisArgs?: any): Disposable {
      try {
        return extHostCommands.registerCommand(true, id, command, thisArgs);
      } catch {
        return new Disposable(() => {});
      }
    },
    executeCommand<T>(id: string, ...args: any[]): Thenable<T | undefined> {
      const extensionInfo: IExtensionInfo = {
        id: extension.id,
        extensionId: extension.extensionId,
        isBuiltin: extension.isBuiltin,
      };

      return extHostCommands.$executeCommandWithExtensionInfo<T>(id, extensionInfo, ...args);
    },
    getCommands(filterInternal = false): Thenable<string[]> {
      return extHostCommands.getCommands(filterInternal);
    },
    registerTextEditorCommand(
      id: string,
      callback: (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => void,
      thisArg?: any,
    ): vscode.Disposable {
      return extHostCommands.registerCommand(true, id, (...args: any[]): any => {
        const activeTextEditor = extHostEditors.activeEditor ? extHostEditors.activeEditor.textEditor : undefined;
        if (!activeTextEditor) {
          getDebugLogger().warn('Cannot execute ' + id + ' because there is no active text editor.');
          return undefined;
        }

        return activeTextEditor
          .edit((edit: vscode.TextEditorEdit) => {
            args.unshift(activeTextEditor, edit);
            callback.apply(thisArg, args as [vscode.TextEditor, vscode.TextEditorEdit, ...any[]]);
          })
          .then(
            (result) => {
              if (!result) {
                getDebugLogger().warn('Edits from command ' + id + ' were not applied.');
              }
            },
            (err) => {
              getDebugLogger().warn('An error occurred while running command ' + id, err);
            },
          );
      });
    },
    registerDiffInformationCommand(
      id: string,
      callback: (diff: vscode.LineChange[], ...args: any[]) => any,
      thisArg?: any,
    ): vscode.Disposable {
      return extHostCommands.registerCommand(true, id, async (...args: any[]): Promise<any> => {
        const activeTextEditor = extHostEditors.activeEditor;
        if (!activeTextEditor) {
          getDebugLogger().warn('Cannot execute ' + id + ' because there is no active text editor.');
          return undefined;
        }

        const diff = await extHostEditors.getDiffInformation(activeTextEditor.id);
        callback.apply(thisArg, [diff, ...args]);
      });
    },
  };

  return commands;
}

export class ExtHostCommands implements IExtHostCommands {
  protected readonly proxy: IMainThreadCommands;
  protected readonly rpcProtocol: IRPCProtocol;
  protected readonly logger = getDebugLogger();
  protected readonly commands = new Map<string, CommandHandler<any>>();
  protected readonly argumentProcessors: ArgumentProcessor[] = [];
  private readonly _apiCommands = new Map<string, ApiCommand>();
  public converter: CommandsConverter;

  constructor(rpcProtocol: IRPCProtocol, private buildInCommands?: IBuiltInCommand[]) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadCommands);
    this.registerUriArgProcessor();
  }

  private registerUriArgProcessor() {
    this.registerArgumentProcessor({
      processArgument: (arg: any) => {
        // 将通信后 toJSON 的 Uri object 转换回 Uri 实例
        // 插件里面用了 `instanceof Uri`
        if (Uri.isUri(arg)) {
          return Uri.from(arg);
        }

        // 数组参数的处理
        if (isNonEmptyArray(arg)) {
          return arg.map((item) => {
            if (Uri.isUri(item)) {
              return Uri.from(item);
            }
            return item;
          });
        }

        return arg;
      },
    });
  }

  // 需要在 $registerBuiltInCommands 一起注册 避免插件进程启动但浏览器未启动时报错
  public $registerCommandConverter() {
    this.converter = new CommandsConverter(this, (id) => {
      // API commands that have no return type (void) can be
      // converted to their internal command and don't need
      // any indirection commands
      const candidate = this._apiCommands.get(id);
      return candidate?.result === ApiCommandResult.Void ? candidate : undefined;
    });
  }

  public $registerBuiltInCommands() {
    if (this.buildInCommands) {
      this.logger.log('register builtIn commands');
      for (const command of this.buildInCommands) {
        const { id, handler } = command;
        this.logger.verbose(`register builtIn command ${id}`);
        this.register(id, handler);
      }
    }

    for (const command of newCommands) {
      this.registerApiCommand(command);
    }
  }

  registerApiCommand(apiCommand: ApiCommand): Disposable {
    const registration = this.registerCommand(
      false,
      apiCommand.id,
      async (...apiArgs) => {
        const internalArgs = apiCommand.args.map((arg, i) => {
          if (!arg.validate(apiArgs[i])) {
            throw new Error(`Invalid argument '${arg.name}' when running '${apiCommand.id}', received: ${apiArgs[i]}`);
          }
          return arg.convert(apiArgs[i]);
        });

        const internalResult = await this.executeCommand(apiCommand.internalId, ...internalArgs);
        return apiCommand.result.convert(internalResult, apiArgs, this.converter);
      },
      undefined,
      {
        description: apiCommand.description,
        args: apiCommand.args,
        returns: apiCommand.result.description,
      },
    );

    this._apiCommands.set(apiCommand.id, apiCommand);

    return new Disposable(() => {
      registration.dispose();
      this._apiCommands.delete(apiCommand.id);
    });
  }

  private register(
    id: string,
    commandHandler: CommandHandler | Handler,
    description?: ICommandHandlerDescription,
  ): Disposable {
    if (isFunction(commandHandler)) {
      return this.registerCommand(false, id, {
        handler: commandHandler,
        thisArg: this,
        description,
      });
    }
    return this.registerCommand(false, id, { ...commandHandler, thisArg: this });
  }

  registerCommand(
    global: boolean,
    id: string,
    handler: CommandHandler | Handler,
    thisArg?: any,
    description?: ICommandHandlerDescription,
  ): Disposable {
    this.logger.log('ExtHostCommands#registerCommand', id);

    if (!id.trim().length) {
      throw new Error('invalid id');
    }

    if (this.commands.has(id)) {
      throw new Error(`command '${id}' already exists`);
    }

    if (isFunction(handler)) {
      this.commands.set(id, {
        handler,
        thisArg,
        description,
      });
    } else {
      this.commands.set(id, handler);
    }
    if (global) {
      this.proxy.$registerCommand(id);
    }

    return Disposable.create(() => {
      if (this.commands.delete(id)) {
        if (global) {
          this.proxy.$unregisterCommand(id);
        }
      }
    });
  }

  $executeContributedCommand<T>(id: string, ...args: any[]): Promise<T> {
    this.logger.log('ExtHostCommands#$executeContributedCommand', id);

    if (!this.commands.has(id)) {
      return Promise.reject(new Error(`Contributed command '${id}' does not exist.`));
    } else {
      args = args.map((arg) => this.argumentProcessors.reduce((r, p) => p.processArgument(r), arg));
      return this.executeLocalCommand(id, args);
    }
  }

  private convertArguments(args: any[]) {
    return cloneAndChange(args, (value) => {
      if (value instanceof Position) {
        return extHostTypeConverter.fromPosition(value);
      }
      if (value instanceof Range) {
        return extHostTypeConverter.fromRange(value);
      }
      if (value instanceof Location) {
        return extHostTypeConverter.fromLocation(value);
      }
      if (!Array.isArray(value)) {
        return value;
      }
    });
  }

  async $executeCommandWithExtensionInfo<T>(
    id: string,
    extensionInfo: IExtensionInfo,
    ...args: any[]
  ): Promise<T | undefined> {
    if (this.commands.has(id)) {
      const isPermitted = this.isPermittedCommand(id, extensionInfo, ...args);
      if (!isPermitted) {
        throw new Error(`Extension ${extensionInfo.id} has not permit to execute ${id}`);
      }
      return this.executeLocalCommand<T>(id, args);
    } else {
      // automagically convert some argument types
      args = this.convertArguments(args);

      return this.proxy
        .$executeCommandWithExtensionInfo<T>(id, extensionInfo, ...args)
        .then((result) => revive(result, 0));
    }
  }

  async executeCommand<T>(id: string, ...args: any[]): Promise<T> {
    this.logger.log('ExtHostCommands#executeCommand', id, args);

    if (this.commands.has(id)) {
      return this.executeLocalCommand<T>(id, args);
    } else {
      // automagically convert some argument types
      args = this.convertArguments(args);

      return this.proxy.$executeCommand<T>(id, ...args).then((result) => revive(result, 0));
    }
  }

  private executeLocalCommand<T>(id: string, args: any[]): Promise<T> {
    const commandHandler = this.commands.get(id);
    if (!commandHandler) {
      throw new Error(`Command ${id} no handler`);
    }
    const { handler, thisArg, description } = commandHandler;

    if (description && description.args) {
      for (let i = 0; i < description.args.length; i++) {
        try {
          validateConstraint(args[i], description.args[i].constraint);
        } catch (err) {
          return Promise.reject(
            new Error(
              `Running the contributed command:'${id}' failed. Illegal argument '${description.args[i].name}' - ${description.args[i].description}`,
            ),
          );
        }
      }
    }
    // todo: 这里做拦截
    try {
      const result = handler.apply(thisArg, this.processArguments(args));
      return Promise.resolve(result);
    } catch (err) {
      this.logger.error(err, id);
      return Promise.reject(new Error(`Running the contributed command:'${id}' failed.`));
    }
  }

  private processArguments(arg: any[]) {
    if (Array.isArray(arg) && Array.isArray(arg[0]) && arg[0].length === 2) {
      const position = arg[0];
      if (Position.isPosition(position[0]) && Position.isPosition(position[1])) {
        return [
          new Range(
            new Position(position[0].line, position[0].character),
            new Position(position[1].line, position[1].character),
          ),
        ];
      }
    }

    return arg;
  }

  async getCommands(filterUnderscoreCommands = false): Promise<string[]> {
    this.logger.log('ExtHostCommands#getCommands', filterUnderscoreCommands);

    const result = await this.proxy.$getCommands();
    if (filterUnderscoreCommands) {
      return result.filter((command) => command[0] !== '_');
    }
    return result;
  }

  registerArgumentProcessor(processor: ArgumentProcessor): void {
    this.argumentProcessors.push(processor);
  }

  private isPermittedCommand(commandId: string, extensionInfo: IExtensionInfo, ...args: any[]): boolean {
    const commandHandler = this.commands.get(commandId);
    if (!commandHandler) {
      // 说明不是插件进程命令，是主进程命令
      return true;
    }
    const { isPermitted } = commandHandler;
    return !isPermitted || isPermitted(extensionInfo, ...args);
  }
}

export class CommandsConverter {
  private readonly _delegatingCommandId: string;
  private readonly _commands: ExtHostCommands;
  private readonly _cache = new Map<number, vscode.Command>();
  private _cachIdPool = 0;

  // --- conversion between internal and api commands
  constructor(commands: ExtHostCommands, private readonly _lookupApiCommand: (id: string) => ApiCommand | undefined) {
    this._delegatingCommandId = `_vscode_delegate_cmd_${Date.now().toString(36)}`;
    this._commands = commands;
    this._commands.registerCommand(true, this._delegatingCommandId, this._executeConvertedCommand, this);
  }

  toInternal(command: vscode.Command | undefined, disposables: DisposableStore): CommandDto | undefined {
    if (!command) {
      return undefined;
    }

    const result: CommandDto = {
      $ident: undefined,
      id: command.command,
      title: command.title,
      tooltip: command.tooltip,
    };
    const apiCommand = this._lookupApiCommand(command.command);
    if (apiCommand) {
      // API command with return-value can be converted inplace
      result.id = apiCommand.internalId;
      result.arguments = apiCommand.args.map((arg, i) => arg.convert(command.arguments && command.arguments[i]));
    } else if (isNonEmptyArray(command.arguments)) {
      // we have a contributed command with arguments. that
      // means we don't want to send the arguments around

      const id = ++this._cachIdPool;
      this._cache.set(id, command);
      disposables.add(
        toDisposable(() => {
          this._cache.delete(id);
        }),
      );
      result.$ident = id;

      result.id = this._delegatingCommandId;
      result.arguments = [id];
    }

    return result;
  }

  fromInternal(command: modes.VSCommand): vscode.Command | undefined {
    const id = ObjectIdentifier.of(command);
    if (typeof id === 'number') {
      return this._cache.get(id);
    } else {
      return {
        command: command.id,
        title: command.title,
        arguments: command.arguments,
      };
    }
  }

  private _executeConvertedCommand<T>(...args: any[]): Promise<T> {
    const actualCmd = this._cache.get(args[0]);
    if (!actualCmd) {
      return Promise.reject('actual command NOT FOUND');
    }
    return this._commands.executeCommand(actualCmd.command, ...(actualCmd.arguments || []));
  }
}
