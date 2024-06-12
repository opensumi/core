import { Domain, PreferenceContribution } from '@opensumi/ide-core-browser';

import { aiNativePreferenceSchema } from './schema';

@Domain(PreferenceContribution)
export class AINativePreferencesContribution implements PreferenceContribution {
  schema = aiNativePreferenceSchema;
}
