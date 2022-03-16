import { Injectable, Autowired, Injector, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { ILogger, CommandRegistry, IExtensionInfo } from '@opensumi/ide-core-common';
import { ICommandServiceToken, IMonacoCommandService } from '@opensumi/ide-monaco/lib/browser/contrib/command';

import { IExtension } from '../../common';
import { ExtHostAPIIdentifier } from '../../common/vscode';
import { IExtHostCommands } from '../../common/vscode/command';

@Injectable()
export class KaitianBrowserCommand {
  @Autowired(ICommandServiceToken)
  private readonly monacoCommandService: IMonacoCommandService;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private readonly proxy?: IExtHostCommands;

  constructor(@Optional() private rpcProtocol?: IRPCProtocol) {
    if (this.rpcProtocol) {
      this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
    }
  }

  /**
   * @param id commandid
   * @param extension 插件
   * @param args 参数
   * **允许前端调用的** command 都会注册到 commandRegistry
   * commandRegistry 不存在的 command，表示没有注册或该 command 是通过 extHost 配置的内置命令
   * command 在 commandRegistry 已注册，则优先通过 extHostCommand 调用，这样即可在插件进程执行鉴权逻辑
   * 否则仅在前端鉴权后执行，对于没有后端或没有 extHost 的情况下，满足执行前端命令的需求
   */
  public async executeCommand<T>(id: string, extension: IExtension, ...args: any[]): Promise<T | undefined> {
    const extensionInfo: IExtensionInfo = {
      id: extension.id,
      extensionId: extension.extensionId,
      isBuiltin: extension.isBuiltin,
    };
    const command = this.commandRegistry.getCommand(id);
    if (this.proxy && command) {
      return this.proxy.$executeCommandWithExtensionInfo(id, extensionInfo, ...args);
    }
    const isPermitted = this.commandRegistry.isPermittedCommand(id, extensionInfo, ...args);
    if (!isPermitted) {
      throw new Error(`Extension ${extensionInfo.id} has not permit to execute ${id}`);
    }

    try {
      return await this.monacoCommandService.executeCommand(id, ...args);
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}

export function createBrowserCommandsApiFactory(injector: Injector, extension: IExtension, rpcProtocol?: IRPCProtocol) {
  const commands: KaitianBrowserCommand = injector.get(KaitianBrowserCommand, [rpcProtocol]);
  return {
    executeCommand<T>(command: string, ...args: any) {
      return commands.executeCommand<T>(command, extension, ...args);
    },
  };
}
