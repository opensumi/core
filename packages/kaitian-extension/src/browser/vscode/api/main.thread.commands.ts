import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadCommands, IExtHostCommands } from '../../../common/vscode';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { CommandRegistry, ILogger, IContextKeyService, IDisposable } from '@ali/ide-core-browser';
import { MonacoCommandService } from '@ali/ide-monaco/lib/browser/monaco.command.service';
import { fromPosition } from '../../../common/vscode/converter';

@Injectable({multiple: true})
export class MainThreadCommands implements IMainThreadCommands {
  private readonly proxy: IExtHostCommands;

  private readonly commands = new Map<string, IDisposable>();

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

  }

  $registerCommand(id: string): void {
    // this.logger.log('$registerCommand id', id);
    const proxy = this.proxy;
    this.commands.set(id, this.commandRegistry.registerCommand({
      id,
    }, {
      execute: (...args) => {
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
}
