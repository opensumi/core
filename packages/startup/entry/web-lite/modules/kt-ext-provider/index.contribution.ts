import { Autowired } from '@opensumi/di';
import { Domain, URI, AppConfig, ClientAppContribution } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import { StaticResourceContribution, StaticResourceService } from '@opensumi/ide-static-resource/lib/browser/static.definition';

import { KaitianExtFsProvider } from './fs-provider';

const EXPRESS_SERVER_PATH = window.location.href;

@Domain(ClientAppContribution, StaticResourceContribution)
export class KtExtFsProviderContribution implements ClientAppContribution, StaticResourceContribution {
  @Autowired(IFileServiceClient)
  private readonly fileSystem: FileServiceClient;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired()
  private readonly ktExtFsProvider: KaitianExtFsProvider;

  registerStaticResolver(service: StaticResourceService): void {
    // 直接依赖插件市场内置的插件服务，无需抽象外部依赖
    // 处理 kt-ext 的协议内容获取
    service.registerStaticResourceProvider({
      scheme: 'kt-ext',
      resolveStaticResource: (uri: URI) => {
        // kt-ext 协议统一走 scheme 头转换为 https
        return uri.withScheme('https');
      },
      roots: [this.appConfig.staticServicePath || EXPRESS_SERVER_PATH],
    });
  }

  initialize() {
    // 注册 kt-ext 作为纯前端插件的自定义协议
    this.fileSystem.registerProvider('kt-ext', this.ktExtFsProvider);
  }
}
