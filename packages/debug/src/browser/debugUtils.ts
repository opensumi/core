import { equalsIgnoreCase } from '@ali/ide-core-browser';
import { DebugConfiguration } from '../common';

export function isExtensionHostDebugging(config: DebugConfiguration) {
  return config.type && equalsIgnoreCase(config.type === 'vslsShare' ? (config as any).adapterProxy.configuration.type : config.type, 'extensionhost');
}

/**
 * request 为 attach 时，排除连接非远程机器 ip 的情况
 */
export function isRemoteAttach(config: DebugConfiguration): boolean {
  if (config.request === 'attach') {
    /**
     * key: 调试语言 type
     * value: 不同语言的调试插件在 attach 模式下. 要 attach 上的 TCP/IP 地址所对应的 launch 属性
     */
    const map = {
      node: 'address',
      java: 'hostName',
      go: 'host',
      cppdbg: 'miDebuggerServerAddress',
      python: 'host',
    };

    const { type } = config;
    const host = config[map[type]];

    if (host) {
      return !['localhost', '127.0.0.1', '::1'].includes(host);
    }

    return true;

  }
  return false;
}
