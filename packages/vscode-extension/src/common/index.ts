import {ProxyIdentifier, createMainContextProxyIdentifier, createExtHostContextProxyIdentifier} from '@ali/ide-connection';

export const MainThreadAPIIdentifier = {
  MainThreadCommands: createMainContextProxyIdentifier('MainThreadCommands'),
};
export const ExtHostAPIIdentifier = {
  ExtHostCommands: createExtHostContextProxyIdentifier('ExtHostCommands'),
  ExtHostExtensionService: createExtHostContextProxyIdentifier('ExtHostExtensionService'),
};
export interface IRPCProtocol {
  getProxy(proxyId: ProxyIdentifier): any;
  set<T>(identifier: ProxyIdentifier, instance: T): T;
}
export abstract class VSCodeExtensionNodeService {
  abstract async getExtHostPath(): Promise<string>;
}

export const VSCodeExtensionNodeServiceServerPath = 'VSCodeExtensionNodeServiceServerPath';

export abstract class ExtensionProcessService {

}
