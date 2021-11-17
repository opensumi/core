import { Injectable } from '@ide-framework/common-di';
import { Disposable, IDisposable } from '@ide-framework/ide-core-common';

import { ExtensionHostType, IExtCommandManagement } from '../common';
import { IMainThreadCommands } from '../common/vscode';

/**
 * 管理插件命令的运行环境
 */
@Injectable()
export class ExtCommandManagementImpl extends Disposable implements IExtCommandManagement {
  /**
   * 存储插件的 command 的注册环境
   */
  private commandEnvRegistry = new Map<string, ExtensionHostType>();

  /**
   * 存储不同执行环境的 command 的 executor
   */
  private proxyCommandExecutorRegistry = new Map<ExtensionHostType, IMainThreadCommands>();

  public dispose() {
    this.commandEnvRegistry.clear();
    this.proxyCommandExecutorRegistry.clear();
  }

  public registerProxyCommandExecutor(env: ExtensionHostType, proxyCommandExecutor: IMainThreadCommands) {
    this.proxyCommandExecutorRegistry.set(env, proxyCommandExecutor);
  }

  public async executeExtensionCommand(env: ExtensionHostType, command: string, args: any[]): Promise<any> {
    const targetProxyCommandExecutor = this.proxyCommandExecutorRegistry.get(env);
    if (!targetProxyCommandExecutor) {
      throw new Error('Proxy command executor"' + env + '" is not existed');
    }
    return targetProxyCommandExecutor.$executeExtensionCommand(command, ...args);
  }

  /**
   * 标记 command 的运行环境
   */
  public registerExtensionCommandEnv(command: string, targetHost: ExtensionHostType = 'node'): IDisposable {
    this.commandEnvRegistry.set(command, targetHost);
    return {
      dispose: () => {
        this.commandEnvRegistry.delete(command);
      },
    };
  }

  public getExtensionCommandEnv(command: string): ExtensionHostType | undefined {
    return this.commandEnvRegistry.get(command);
  }
}
