import { AiNativeContribution as AiNativeCoreContribution, IAiRunFeatureRegistry } from '@opensumi/ide-ai-native';
import { Domain } from '@opensumi/ide-core-browser';

@Domain(AiNativeCoreContribution)
export class AiNativeContribution implements AiNativeCoreContribution {
  registerRunFeature(registry: IAiRunFeatureRegistry) {
    // Not implements
  }
}
