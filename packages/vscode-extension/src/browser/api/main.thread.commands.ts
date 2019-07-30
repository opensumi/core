import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadCommands, IExtHostCommands } from '../../common';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { CommandRegistry, ILogger, CommandService } from '@ali/ide-core-browser';
import { MonacoCommandService } from '@ali/ide-monaco/lib/browser/monaco.command.service';
import { fromPosition } from '../../common/converter';

@Injectable()
export class MainThreadCommands implements IMainThreadCommands {
  private readonly proxy: IExtHostCommands;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired()
  monacoCommandService: MonacoCommandService;

  @Autowired(ILogger)
  logger: ILogger;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
    this.proxy.$registerBuiltInCommands();
    this.registerBuiltInCommands();
  }

  private registerBuiltInCommands(): void {
    // TODO 需要实现 registerDefaultLanguageCommand @寻壑
    this.commandRegistry.registerCommand({
      id: '_executeReferenceProvider',
    });
  }

  $registerCommand(id: string): void {
    this.logger.log('$registerCommand id', id);
    const proxy = this.proxy;
    this.commandRegistry.registerCommand({
      id: id + ':extHost',
    }, {
        execute: (...args) => {
          return proxy.$executeContributedCommand(id, ...args);
        },
      });
  }

  $unregisterCommand(id: string): void {
    throw new Error('Method not implemented.');
  }

  $getCommands(): Promise<string[]> {
    return Promise.resolve(this.commandRegistry.getCommands().map((command) => command.id));
  }

  $executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined> {
    try {
      return this.commandService.executeCommand(id, ...args);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async $executeReferenceProvider(arg) {
    arg.resource = monaco.Uri.revive(arg.resource);
    arg.position = fromPosition(arg.position);
    return this.monacoCommandService.executeCommand('_executeReferenceProvider', arg);
  }
}
