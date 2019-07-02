import {IRPCProtocol, MainThreadAPIIdentifier} from '../../common';

export class ExtHostCommands {
  private readonly _proxy: any;
  private readonly rpcProtocol: IRPCProtocol;
  private readonly _logService: any;

  private readonly _commands = new Map<string, any>();

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this._proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadCommands);
    this._logService = {
      trace() {
        console.log.apply(console, arguments as any);
      },
    };
  }

  registerCommand(global: boolean = true, id: string, callback: <T>(...args: any[]) => T | Promise<T>, thisArg?: any, description?: string) {
    this._logService.trace('ExtHostCommands#registerCommand', id);

    if (!id.trim().length) {
      throw new Error('invalid id');
    }

    if (this._commands.has(id)) {
      throw new Error(`command '${id}' already exists`);
    }

    this._commands.set(id, { callback, thisArg, description });
    if (global) {
      this._proxy.$registerCommand(id);
    }

    return () => {
      if (this._commands.delete(id)) {
        if (global) {
          this._proxy.$unregisterCommand(id);
        }
      }
    };
  }

  $executeContributedCommand<T>(id: string, ...args: any[]): Promise<T> {
    this._logService.trace('ExtHostCommands#$executeContributedCommand', id);

    if (!this._commands.has(id)) {
      return Promise.reject(new Error(`Contributed command '${id}' does not exist.`));
    } else {
      // args = args.map(arg => this._argumentProcessors.reduce((r, p) => p.processArgument(r), arg));
      return this._executeContributedCommand(id, args);
    }
  }

  executeCommand<T>(id: string, ...args: any[]) {
    this._logService.trace('ExtHostCommands#executeCommand', id);

    if (this._commands.has(id)) {
      // we stay inside the extension host and support
      // to pass any kind of parameters around
      return this._executeContributedCommand<T>(id, args);

    }
    // else {
    // 	// automagically convert some argument types

    // 	args = cloneAndChange(args, function (value) {
    // 		if (value instanceof extHostTypes.Position) {
    // 			return extHostTypeConverter.Position.from(value);
    // 		}
    // 		if (value instanceof extHostTypes.Range) {
    // 			return extHostTypeConverter.Range.from(value);
    // 		}
    // 		if (value instanceof extHostTypes.Location) {
    // 			return extHostTypeConverter.location.from(value);
    // 		}
    // 		if (!Array.isArray(value)) {
    // 			return value;
    // 		}
    // 	});

    // 	return this._proxy.$executeCommand<T>(id, args).then(result => revive(result, 0));
    // }
  }

  private _executeContributedCommand<T>(id: string, args: any[]): Promise<T> {
    const { callback, thisArg, description } = this._commands.get(id);
    // if (description) {
    // 	for (let i = 0; i < description.args.length; i++) {
    // 		try {
    // 			validateConstraint(args[i], description.args[i].constraint);
    // 		} catch (err) {
    // 			return Promise.reject(new Error(`Running the contributed command:'${id}' failed. Illegal argument '${description.args[i].name}' - ${description.args[i].description}`));
    // 		}
    // 	}
    // }

    try {
      const result = callback.apply(thisArg, args);
      return Promise.resolve(result);
    } catch (err) {
      this._logService.error(err, id);
      return Promise.reject(new Error(`Running the contributed command:'${id}' failed.`));
    }
  }

}
