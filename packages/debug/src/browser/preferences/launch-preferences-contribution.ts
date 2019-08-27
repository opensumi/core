import { PreferenceContribution, PreferenceSchema, Domain } from '@ali/ide-core-browser';
import { launchPreferencesSchema } from './launch-preferences';

@Domain(PreferenceContribution)
export class LaunchPreferencesContribution implements PreferenceContribution {
  schema: PreferenceSchema = launchPreferencesSchema;
}
