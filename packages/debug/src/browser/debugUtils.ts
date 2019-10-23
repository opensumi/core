import { equalsIgnoreCase } from '@ali/ide-core-browser';
import { DebugConfiguration } from '../common';

export function isExtensionHostDebugging(config: DebugConfiguration) {
  return config.type && equalsIgnoreCase(config.type === 'vslsShare' ? (config as any).adapterProxy.configuration.type : config.type, 'extensionhost');
}
