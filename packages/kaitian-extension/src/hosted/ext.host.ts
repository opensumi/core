import * as vscode from 'vscode';
import { RPCProtocol } from '@ali/ide-connection';
import { getLogger, Emitter } from '@ali/ide-core-common';
import { IExtensionMetaData } from '../common';
import { ExtHostStorage } from './api/vscode/api/ext.host.storage';
import { createApiFactory } from './api/vscode/api/ext.host.api.impl';
import { MainThreadAPIIdentifier } from '../common/vscode';

const logger = getLogger();

export default class ExtensionHostService {
  private extensions: IExtensionMetaData[];
  private rpcProtocol: RPCProtocol;

  private vscodeAPIFactory: any;
  private vscodeExtAPIImpl: Map<string, any>;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any>;

  private storage: ExtHostStorage;

  // TODO: 待实现 API
  // $activateExtension(id: string): Promise<void>;
  // activateExtension(id: string): Promise<void>;
  // getExtensions(): IFeatureExtension[];
  // $getExtensions(): IFeatureExtension[];
  // getExtension(extensionId: string): vscode.Extension<any> | undefined;

  extensionsChangeEmitter: Emitter<string>;

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.storage = new ExtHostStorage(rpcProtocol);
    this.vscodeAPIFactory = createApiFactory(
      this.rpcProtocol,
      this as any,
    );
    this.vscodeExtAPIImpl = new Map();
  }

  public async init() {
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie).$getExtensions();

    logger.log('kaitian extensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));
  }

}
