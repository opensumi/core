import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  ContributionProvider,
  DisposableStore,
  Domain,
  FsProviderContribution,
  IDisposable,
  Schemes,
} from '@opensumi/ide-core-browser';

import { IDiskFileProvider, IFileServiceClient } from '../common';

import { FileServiceClient } from './file-service-client';

// 常规文件资源读取
@Domain(ClientAppContribution)
export class FileServiceContribution implements ClientAppContribution, IDisposable {
  private _disposables = new DisposableStore();

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  @Autowired(IDiskFileProvider)
  private diskFileServiceProvider: IDiskFileProvider;

  @Autowired(FsProviderContribution)
  contributionProvider: ContributionProvider<FsProviderContribution>;

  constructor() {
    // 初始化资源读取逻辑，需要在最早初始化时注册
    // 否则后续注册的 debug\user_stroage 等将无法正常使用
    this._disposables.add(this.fileSystem.registerProvider(Schemes.file, this.diskFileServiceProvider));
  }

  async initialize() {
    const fsProviderContributions = this.contributionProvider.getContributions();

    await Promise.all(
      fsProviderContributions.map(async (contrib) => {
        contrib.registerProvider && (await contrib.registerProvider(this.fileSystem));
      }),
    );

    await Promise.all(
      fsProviderContributions.map(async (contrib) => {
        contrib.onFileServiceReady && (await contrib.onFileServiceReady());
      }),
    );

    if (this.fileSystem.initialize) {
      await this.fileSystem.initialize();
    }
  }

  dispose() {
    this._disposables.dispose();
  }
}
