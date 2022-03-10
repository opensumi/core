import { Autowired } from '@opensumi/di';
import {
  Domain,
  FsProviderContribution,
  ContributionProvider,
  ClientAppContribution,
} from '@opensumi/ide-core-browser';

import { IFileServiceClient, IDiskFileProvider, FILE_SCHEME } from '../common';

import { FileServiceClient } from './file-service-client';

// 常规文件资源读取
@Domain(ClientAppContribution)
export class FileServiceContribution implements ClientAppContribution {
  @Autowired(IFileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  @Autowired(IDiskFileProvider)
  private diskFileServiceProvider: IDiskFileProvider;

  @Autowired(FsProviderContribution)
  contributionProvider: ContributionProvider<FsProviderContribution>;

  constructor() {
    // 初始化资源读取逻辑，需要在最早初始化时注册
    // 否则后续注册的 debug\user_stroage 等将无法正常使用
    this.fileSystem.registerProvider(FILE_SCHEME, this.diskFileServiceProvider);
  }

  async initialize() {
    const fsProviderContributions = this.contributionProvider.getContributions();
    for (const contribution of fsProviderContributions) {
      contribution.registerProvider && (await contribution.registerProvider(this.fileSystem));
    }
    for (const contribution of fsProviderContributions) {
      contribution.onFileServiceReady && (await contribution.onFileServiceReady());
    }
  }
}
