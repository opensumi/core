import { Injectable } from '@ali/common-di';
import * as path from 'path';
import {createExtHostContextProxyIdentifier, createMainContextProxyIdentifier, ProxyIdentifier} from '@ali/ide-connection';

export const ExtensionNodeServiceServerPath = 'ExtensionNodeService';

export interface IExtensionCandidate {

  path: string;

  packageJSON: {[key: string]: any};

  extraMetaData: {
    [key: string]: string | null;
  };

}

@Injectable()
export abstract class ExtensionNodeService {
  abstract async getAllCandidatesFromFileSystem(scan: string[], candidate: string[], extraMetaData: {[key: string]: string; }): Promise<IExtensionCandidate[]>;
  abstract async createExtProcess(): Promise<void>;
  abstract async getExtServerListenPath(): Promise<string>;
}

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
