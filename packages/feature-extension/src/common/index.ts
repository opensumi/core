import { Injectable } from '@ali/common-di';
import * as path from 'path';
import {createExtHostContextProxyIdentifier, createMainContextProxyIdentifier, ProxyIdentifier} from '@ali/ide-connection';
import * as cp from 'child_process';
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
  abstract getExtServerListenPath(name: string): string;
  abstract async createProcess(name: string, preload: string, args?: string[], options?: cp.ForkOptions);
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
