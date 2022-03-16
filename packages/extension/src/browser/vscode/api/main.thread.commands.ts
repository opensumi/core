import { Injectable, Autowired, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { CommandRegistry, ILogger, IContextKeyService, IDisposable } from '@opensumi/ide-core-browser';
import { URI, isNonEmptyArray, Disposable, IExtensionInfo } from '@opensumi/ide-core-common';
import { ICommandServiceToken, IMonacoCommandService } from '@opensumi/ide-monaco/lib/browser/contrib/command';

import { ExtHostAPIIdentifier, IMainThreadCommands, IExtHostCommands, ArgumentProcessor } from '../../../common/vscode';

export interface IExtCommandHandler extends IDisposable {
  execute: (...args: any[]) => Promise<any>;
}
@Injectable({ multiple: true })
export class MainThreadCommands implements IMainThreadCommands {
  private readonly proxy: IExtHostCommands;

  private readonly commands = new Map<string, IExtCommandHandler>();

  protected readonly argumentProcessors: ArgumentProcessor[] = [];

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(ICommandServiceToken)
  monacoCommandService: IMonacoCommandService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IContextKeyService)
  protected contextKeyService: IContextKeyService;

  private disposable = new Disposable();

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol, fromWorker?: boolean) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
    if (!fromWorker) {
      this.proxy.$registerBuiltInCommands();
    }

    this.proxy.$registerCommandConverter();
    this.registerUriArgProcessor();
  }

  private registerUriArgProcessor() {
    this.disposable.addDispose(
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
      }),
    );
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
      dispose: () => disposer.dispose(),
    };

    const command = this.commandRegistry.getCommand(id);
    if (command) {
      // 如果已经有对应的命令则注册为 handler
      // 后面注册的命令会覆盖前面注册的的命令
      disposer.addDispose(this.commandRegistry.registerHandler(id, { execute }));
    } else {
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

  $executeCommandWithExtensionInfo<T>(
    id: string,
    extensionInfo: IExtensionInfo,
    ...args: any[]
  ): Promise<T | undefined> {
    const isPermitted = this.commandRegistry.isPermittedCommand(id, extensionInfo, ...args);
    if (!isPermitted) {
      throw new Error(`Extension ${extensionInfo.id} has not permit to execute ${id}`);
    }
    return this.$executeCommand<T>(id, ...args);
  }

  async $executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined> {
    try {
      return await this.monacoCommandService.executeCommand(id, ...args);
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}
