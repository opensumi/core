import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { Disposable, Position, Range, Location, CodeLens, SymbolInformation } from '../../../common/vscode/ext-types';
import * as extHostTypeConverter from '../../../common/vscode/converter';
import { MainThreadAPIIdentifier, IMainThreadCommands, IExtHostCommands, Handler, ArgumentProcessor, ICommandHandlerDescription } from '../../../common/vscode';
import { cloneAndChange } from '@ali/ide-core-common/lib/utils/objects';
import { validateConstraint } from '@ali/ide-core-common/lib/utils/types';
import { ILogger, getDebugLogger, revive, toDisposable, DisposableStore, isNonEmptyArray } from '@ali/ide-core-common';
import { ExtensionHostEditorService } from './editor/editor.host';
import { ObjectIdentifier } from './language/util';
import { CommandDto } from '../../../common/vscode/scm';
import * as modes from '../../../common/vscode/model.api';
import Uri from 'vscode-uri';

export function createCommandsApiFactory(extHostCommands: IExtHostCommands, extHostEditors: ExtensionHostEditorService) {
  const commands: typeof vscode.commands = {
    registerCommand(id: string, command: <T>(...args: any[]) => T | Promise<T>, thisArgs?: any): Disposable {
      return extHostCommands.registerCommand(true, id, command, thisArgs);
    },
    executeCommand<T>(id: string, ...args: any[]): Thenable<T | undefined> {
      return extHostCommands.executeCommand<T>(id, ...args);
    },
    getCommands(filterInternal: boolean = false): Thenable<string[]> {
      return extHostCommands.getCommands(filterInternal);
    },
    registerTextEditorCommand(id: string, callback: (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => void, thisArg?: any): vscode.Disposable {
      return extHostCommands.registerCommand(true, id, (...args: any[]): any => {
        const activeTextEditor = extHostEditors.activeEditor ? extHostEditors.activeEditor.textEditor : undefined;
        if (!activeTextEditor) {
          getDebugLogger().warn('Cannot execute ' + id + ' because there is no active text editor.');
          return undefined;
        }

        return activeTextEditor.edit((edit: vscode.TextEditorEdit) => {
          args.unshift(activeTextEditor, edit);
          callback.apply(thisArg, args as [vscode.TextEditor, vscode.TextEditorEdit, ...any[]]);

        }).then((result) => {
          if (!result) {
            getDebugLogger().warn('Edits from command ' + id + ' were not applied.');
          }
        }, (err) => {
          getDebugLogger().warn('An error occurred while running command ' + id, err);
        });
      });
    },
    registerDiffInformationCommand(id: string, callback: (diff: vscode.LineChange[], ...args: any[]) => any, thisArg?: any): vscode.Disposable {
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
  protected readonly logger: ILogger = getDebugLogger();
  protected readonly commands = new Map<string, any & { handler: Handler }>();
  protected readonly argumentProcessors: ArgumentProcessor[] = [];
  public converter: CommandsConverter;

  constructor(rpcProtocol: IRPCProtocol) {
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
  private registerCommandConverter() {
    this.converter = new CommandsConverter(this);
  }

  public $registerBuiltInCommands() {
    this.registerCommandConverter();
    this.register('vscode.executeReferenceProvider', this.executeReferenceProvider, {
      description: 'Execute reference provider.',
      args: [
        { name: 'uri', description: 'Uri of a text document', constraint: Uri },
        { name: 'position', description: 'Position in a text document', constraint: Position },
      ],
      returns: 'A promise that resolves to an array of Location-instances.',
    });
    this.register('vscode.executeImplementationProvider', this.executeImplementationProvider, {
      description: 'Execute all implementation providers.',
      args: [
        { name: 'uri', description: 'Uri of a text document', constraint: Uri },
        { name: 'position', description: 'Position of a symbol', constraint: Position },
      ],
      returns: 'A promise that resolves to an array of Location-instance.',
    });
    this.register('vscode.executeCodeLensProvider', this.executeCodeLensProvider, {
      description: 'Execute CodeLens provider.',
      args: [
        { name: 'uri', description: 'Uri of a text document', constraint: Uri },
        { name: 'itemResolveCount', description: '(optional) Number of lenses that should be resolved and returned. Will only return resolved lenses, will impact performance)', constraint: (value: any) => value === undefined || typeof value === 'number' },
      ],
      returns: 'A promise that resolves to an array of CodeLens-instances.',
    });
    this.register('vscode.executeDocumentSymbolProvider', this.executeDocumentSymbolProvider, {
      description: 'Execute document symbol provider.',
      args: [
        { name: 'uri', description: 'Uri of a text document', constraint: Uri },
      ],
      returns: 'A promise that resolves to an array of SymbolInformation and DocumentSymbol instances.',
    });
  }

  private register(id: string, handler: (...args: any[]) => any, description?: ICommandHandlerDescription): Disposable {
    return this.registerCommand(false, id, handler, this, description);
  }

  registerCommand(global: boolean, id: string, handler: Handler, thisArg?: any, description?: ICommandHandlerDescription): Disposable {
    this.logger.log('ExtHostCommands#registerCommand', id);

    if (!id.trim().length) {
      throw new Error('invalid id');
    }

    if (this.commands.has(id)) {
      throw new Error(`command '${id}' already exists`);
    }

    this.commands.set(id, { handler, thisArg, description });
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

  async executeCommand<T>(id: string, ...args: any[]): Promise<T> {
    this.logger.log('ExtHostCommands#executeCommand', id, args);

    if (this.commands.has(id)) {
      return this.executeLocalCommand<T>(id, args);
    } else {
      // automatically convert some argument types
      args = cloneAndChange(args, (value) => {
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

      return this.proxy.$executeCommand<T>(id, ...args)
        .then((result) => revive(result, 0));
    }
  }

  private executeReferenceProvider(resource: Uri, position: Position): Promise<Location[] | undefined> {
    const arg = {
      resource,
      position,
    };
    return this.proxy.$executeReferenceProvider(arg)
      .then((locations) => {
        return tryMapWith(extHostTypeConverter.toLocation)(locations!);
      });
  }

  private executeImplementationProvider(resource: Uri, position: Position): Promise<Location[] | undefined> {
    const arg = {
      resource,
      position,
    };
    return this.proxy.$executeImplementationProvider(arg)
      .then((locations) => {
        return tryMapWith(extHostTypeConverter.toLocation)(locations!);
      });
  }

  private executeCodeLensProvider(resource: Uri, itemResolveCount: number): Promise<CodeLens[] | undefined> {
    const args = { resource, itemResolveCount };
    return this.proxy.$executeCodeLensProvider(args)
      .then((items) => {
        return items.map((item) => {
          return new CodeLens(
            extHostTypeConverter.toRange(item.range),
            item.command ? this.converter.fromInternal(item.command) : undefined,
          );
        });
      });
  }

  private executeDocumentSymbolProvider(resource: Uri): Promise<vscode.SymbolInformation[] | undefined> {
    const args = {
      resource,
    };
    return this.proxy.$executeDocumentSymbolProvider(args)
      .then((items) => {
        if (!Array.isArray(items) || items === undefined) {
          return undefined;
        }

        class MergedInfo extends SymbolInformation implements vscode.DocumentSymbol {
          static to(symbol: modes.DocumentSymbol): MergedInfo {
            const res = new MergedInfo(
              symbol.name,
              extHostTypeConverter.SymbolKind.toSymbolKind(symbol.kind),
              symbol.containerName || '',
              new Location(resource, extHostTypeConverter.toRange(symbol.range)),
            );
            res.detail = symbol.detail;
            res.range = res.location.range;
            res.selectionRange = extHostTypeConverter.toRange(symbol.selectionRange);
            res.children = symbol.children ? symbol.children.map(MergedInfo.to) : [];
            return res;
          }

          detail!: string;
          range!: vscode.Range;
          selectionRange!: vscode.Range;
          children!: vscode.DocumentSymbol[];
          containerName!: string;
        }
        return items.map(MergedInfo.to);
      });
  }

  private executeLocalCommand<T>(id: string, args: any[]): Promise<T> {
    const { handler, thisArg, description } = this.commands.get(id);
    if (description && description.args) {
      for (let i = 0; i < description.args.length; i++) {
        try {
          validateConstraint(args[i], description.args[i].constraint);
        } catch (err) {
          return Promise.reject(new Error(`Running the contributed command:'${id}' failed. Illegal argument '${description.args[i].name}' - ${description.args[i].description}`));
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
        return [new Range(new Position(position[0].line, position[0].character), new Position(position[1].line, position[1].character))];
      }
    }

    return arg;
  }

  async getCommands(filterUnderscoreCommands: boolean = false): Promise<string[]> {
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

}

function tryMapWith<T, R>(f: (x: T) => R) {
  return (value: T[]) => {
    if (Array.isArray(value)) {
      return value.map(f);
    }
    return undefined;
  };
}

export class CommandsConverter {
  private readonly _delegatingCommandId: string;
  private readonly _commands: ExtHostCommands;
  private readonly _cache = new Map<number, vscode.Command>();
  private _cachIdPool = 0;

  // --- conversion between internal and api commands
  constructor(commands: ExtHostCommands) {
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

    if (command.command && isNonEmptyArray(command.arguments)) {
      // we have a contributed command with arguments. that
      // means we don't want to send the arguments around

      const id = ++this._cachIdPool;
      this._cache.set(id, command);
      disposables.add(toDisposable(() => this._cache.delete(id)));
      result.$ident = id;

      result.id = this._delegatingCommandId;
      result.arguments = [id];

    }

    return result;
  }

  fromInternal(command: modes.Command): vscode.Command | undefined {

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
