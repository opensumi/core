import { FeatureExtensionCapabilityContribution, FeatureExtensionCapabilityRegistry, IFeatureExtension } from '@ali/ide-feature-extension/lib/browser';
import { Domain } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { VscodeExtensionType } from './vscode.extension';
import { LANGUAGE_BUNDLE_FIELD } from './types';

@Domain(FeatureExtensionCapabilityContribution)
export class VsodeExtensionContribution implements FeatureExtensionCapabilityContribution {

  @Autowired()
  vscodeExtensionType: VscodeExtensionType;

  async registerCapability(registry: FeatureExtensionCapabilityRegistry) {

    registry.addFeatureExtensionScanDirectory('~/.vscode/extensions');
    registry.addExtraMetaData(LANGUAGE_BUNDLE_FIELD, './package.nls.' + 'zh-cn' + '.json');
    registry.registerFeatureExtensionType(this.vscodeExtensionType);

  }

}
