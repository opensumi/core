import type * as net from 'net';
import { ProxyIdentifier } from '@ali/ide-connection';

/**
 * 代理服务监听的端口，可以通过 constructor 修改参数
 * @example
 * ```ts
 * injector.addProviders({
 *   token: IExtensionHostManager,
 *   useFactory: (injector) => {
 *     return injector.get(ExtensionHostProxyManager, [{
 *       port: 10299,
 *     }]);
 *   },
 * });
 * ```
 */
export const EXT_HOST_PROXY_SERVER_PROT = 10299;

/**
 * 用于插件后端服务和插件进程代理服务通信的 key
 */
export const EXT_HOST_PROXY_PROTOCOL = 'EXT_HOST_PROXY_PROTOCOL';

/**
 * 插件后端服务代理服务
 */
export interface IExtServerProxyRPCService {
  $callback(callId: number, ...args: any[]): Promise<void>;
}

/**
 * 插件进程代理进程
 */
export interface IExtHostProxy {
  init(): void;
}

/**
 * 插件进程代理服务
 */
export interface IExtHostProxyRPCService {
  /**
   * 远程 fork 进程
   * @param modulePath 插件进程文件
   * @param args
   */
  $fork(modulePath: string, ...args: any[]): Promise<number>;
  /**
   * 指定 pid 发送消息
   * @param pid
   * @param message
   */
  $send(pid: number, message: string): Promise<void>;
  /**
   * 查看指定进程是否存在
   * @param pid
   */
  $isRunning(pid: number): Promise<boolean>;
  /**
   * 杀掉指定进程及其子进程
   * @param pid
   */
  $treeKill(pid: number): Promise<void>;
  /**
   * 杀掉指定进程
   * @param pid
   * @param signal
   */
  $kill(pid: number, signal?: string): Promise<void>;
  /**
   * 指定进程是否被杀死
   */
  $isKilled(pid: number): Promise<boolean>;
  /**
   * 查找 debug 端口
   */
  $findDebugPort(startPort: number, giveUpAfter: number, timeout: number): Promise<number>;
  /**
   * 进程退出执行回调
   */
  $onExit(callId: number, pid: number): Promise<void>;
  /**
   * 拿到 process._debugProcess 启动调试时监听 stdout 的输出获取调试端口
   */
  $onInspect(callId: number, pid: number): Promise<void>;
  /**
   * 消息事件回调
   */
  $onMessage(callId: number, pid: number): Promise<void>;
  /**
   * 销毁指定进程副作用
   * @param pid
   */
  $disposeProcess(pid: number): Promise<void>;
}

export interface IExtHostProxyOptions {
  /**
   * 插件进程代理 socket options
   */
  socketConnectOpts?: net.SocketConnectOpts;
  /**
   * 重连间隔时间
   * 默认 1000ms
   */
  retryTime?: number;
}

/**
 * 插件后端服务 RPC Identifier
 */
export const EXT_SERVER_IDENTIFIER = new ProxyIdentifier<IExtServerProxyRPCService>('EXT_SERVER_IDENTIFIER');

/**
 * 插件进程代理 RPC Identifier
 */
export const EXT_HOST_PROXY_IDENTIFIER = new ProxyIdentifier<IExtHostProxyRPCService>('EXT_HOST_PROXY_IDENTIFIER');
