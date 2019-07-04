import { FeatureExtensionCapabilityContribution, FeatureExtensionCapabilityRegistry, IFeatureExtension, FeatureExtensionManagerService } from '@ali/ide-feature-extension/lib/browser';
import { Domain } from '@ali/ide-core-browser';
import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { VscodeExtensionType } from './vscode.extension';
import { LANGUAGE_BUNDLE_FIELD } from './types';
import {VSCodeExtensionService} from './vscode.extension';

@Domain(FeatureExtensionCapabilityContribution)
export class VsodeExtensionContribution implements FeatureExtensionCapabilityContribution {

  @Autowired()
  vscodeExtensionType: VscodeExtensionType;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  async registerCapability(registry: FeatureExtensionCapabilityRegistry) {

    // registry.addFeatureExtensionScanDirectory('~/.vscode/extensions');
    registry.addExtraMetaData(LANGUAGE_BUNDLE_FIELD, './package.nls.' + 'zh-cn' + '.json');
    registry.registerFeatureExtensionType(this.vscodeExtensionType);

  }

  async onWillEnableFeatureExtensions(extensionService: FeatureExtensionManagerService) {
    const service =  this.injector.get(VSCodeExtensionService, [extensionService]); // new VSCodeExtensionService(extensionService)
    service.createExtensionHostProcess();

    // TODO: 默认启动第一个插件作为验证，时序确认处理，待插件进程中完成服务绑定后调用
    setTimeout(async () => {
      await service.activeExtension();
    }, 2000);
  }

}
