import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadCommands, IExtHostCommands, ArgumentProcessor } from '../../../common/vscode';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { CommandRegistry, ILogger, IContextKeyService, IDisposable } from '@ali/ide-core-browser';
import { MonacoCommandService } from '@ali/ide-monaco/lib/browser/monaco.command.service';
import { fromPosition } from '../../../common/vscode/converter';
import { URI, isNonEmptyArray, Disposable, IExtensionInfo } from '@ali/ide-core-common';

export interface IExtCommandHandler extends IDisposable {
  execute: (...args: any[]) => Promise<any>;
}
@Injectable({multiple: true})
export class MainThreadCommands implements IMainThreadCommands {
  private readonly proxy: IExtHostCommands;

  private readonly commands = new Map<string, IExtCommandHandler >();

  protected readonly argumentProcessors: ArgumentProcessor[] = [];

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired()
  monacoCommandService: MonacoCommandService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IContextKeyService)
  protected contextKeyService: IContextKeyService;

  private disposable = new Disposable();

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
    this.proxy.$registerBuiltInCommands();

    this.registerUriArgProcessor();
  }

  private registerUriArgProcessor() {
    this.disposable.addDispose(this.registerArgumentProcessor({
      processArgument: (arg: any) => {
        if (arg instanceof URI) {
          return (arg as URI).codeUri;
        }

        // 数组参数的处理
        if (isNonEmptyArray(arg)) {
          return arg.map((item) => {
            if (item instanceof URI) {
              return (item as URI).codeUri;
            }
            return item;
          });
        }

        return arg;
      },
    }));
  }

  dispose() {
    this.commands.forEach((comamnd) => {
      comamnd.dispose();
    });
    this.commands.clear();
    this.disposable.dispose();
  }

  registerArgumentProcessor(processor: ArgumentProcessor): IDisposable {
    this.argumentProcessors.push(processor);
    return Disposable.create(() => {
      const idx = this.argumentProcessors.indexOf(processor);
      if (idx >= 0) {
        this.argumentProcessors.splice(idx, 1);
      }
    });
  }

  $registerCommand(id: string): void {
    const proxy = this.proxy;

    const execute = (...args) => {
      args = args.map((arg) => this.argumentProcessors.reduce((r, p) => p.processArgument(r), arg));
      return proxy.$executeContributedCommand(id, ...args);
    };

    const disposer = new Disposable();

    const extCommandHandler: IExtCommandHandler = {
      execute,
      dispose: () => {
        return disposer.dispose();
      },
    };

    /**
     * command 可能在 contribute/commands 通过贡献点已经贡献了 command desc
     * 此时不用再注册，会被extensionService转发到这里来
     */
    const command = this.commandRegistry.getCommand(id);
    if (!command) {
      disposer.addDispose(this.commandRegistry.registerCommand({ id }, { execute }));
    }

    this.commands.set(id, extCommandHandler);
  }

  $unregisterCommand(id: string): void {
    const command = this.commands.get(id);
    if (command) {
      command.dispose();
      this.commands.delete(id);
    }
  }

  $getCommands(): Promise<string[]> {
    return Promise.resolve(this.commandRegistry.getCommands().map((command) => command.id));
  }

  /**
   * 来自main -> extHost的command调用
   */
  $executeExtensionCommand(id: string, ...args: any[]): Promise<any> {
    if (this.commands.has(id)) {
      return this.commands.get(id)!.execute(...args);
    } else {
      args = args.map((arg) => this.argumentProcessors.reduce((r, p) => p.processArgument(r), arg));
      return this.proxy.$executeContributedCommand(id, ...args);
    }
  }

  $executeCommandWithExtensionInfo<T>(id: string, extensionInfo: IExtensionInfo, ...args: any[]): Promise<T | undefined> {
    const isPermitted = this.commandRegistry.isPermittedCommand(id, extensionInfo, ...args);
    if (!isPermitted) {
      throw new Error(`Extension ${extensionInfo.id} has not permit to execute ${id}`);
    }
    return this.$executeCommand<T>(id, ...args);
  }

  $executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined> {
    try {
      // monaco 内置命令转换参数适配
      if (id === 'editor.action.showReferences') {
        return this.monacoCommandService.executeCommand(id, ...[monaco.Uri.parse(args[0]), ...args.slice(1)]);
      }
      return this.monacoCommandService.executeCommand(id, ...args);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async $executeReferenceProvider(arg) {
    arg.resource = monaco.Uri.revive(arg.resource);
    if (arg.position) {
      arg.position = fromPosition(arg.position);
    }
    return this.monacoCommandService.executeCommand('_executeReferenceProvider', arg);
  }

  async $executeImplementationProvider(arg) {
    arg.resource = monaco.Uri.revive(arg.resource);
    if (arg.position) {
      arg.position = fromPosition(arg.position);
    }
    return this.monacoCommandService.executeCommand('_executeImplementationProvider', arg);
  }

  async $executeCodeLensProvider(arg) {
    arg.resource = monaco.Uri.revive(arg.resource);
    return this.monacoCommandService.executeCommand('_executeCodeLensProvider', arg);
  }

  async $executeDocumentSymbolProvider(arg) {
    arg.resource = monaco.Uri.revive(arg.resource);
    return this.monacoCommandService.executeCommand('_executeDocumentSymbolProvider', arg);
  }
}
