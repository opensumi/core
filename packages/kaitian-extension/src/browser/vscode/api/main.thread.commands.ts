import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadCommands, IExtHostCommands, ArgumentProcessor } from '../../../common/vscode';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { CommandRegistry, ILogger, IContextKeyService, IDisposable } from '@ali/ide-core-browser';
import { MonacoCommandService } from '@ali/ide-monaco/lib/browser/monaco.command.service';
import { fromPosition } from '../../../common/vscode/converter';
import { URI, isNonEmptyArray } from '@ali/ide-core-common';

@Injectable({multiple: true})
export class MainThreadCommands implements IMainThreadCommands {
  private readonly proxy: IExtHostCommands;

  private readonly commands = new Map<string, IDisposable>();

  protected readonly argumentProcessors: ArgumentProcessor[] = [];

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired()
  monacoCommandService: MonacoCommandService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IContextKeyService)
  protected contextKeyService: IContextKeyService;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
    this.proxy.$registerBuiltInCommands();

    this.registerUriArgProcessor();
  }

  private registerUriArgProcessor() {
    this.registerArgumentProcessor({
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
    });
  }

  dispose() {
    this.commands.forEach((comamnd) => {
      comamnd.dispose();
    });
    this.commands.clear();
  }

  registerArgumentProcessor(processor: ArgumentProcessor): void {
    this.argumentProcessors.push(processor);
  }

  $registerCommand(id: string): void {
    // this.logger.log('$registerCommand id', id);
    const proxy = this.proxy;
    this.commands.set(id, this.commandRegistry.registerCommand({
      id,
    }, {
      execute: (...args) => {
        args = args.map((arg) => this.argumentProcessors.reduce((r, p) => p.processArgument(r), arg));
        return proxy.$executeContributedCommand(id, ...args);
      },
    }));

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
}
