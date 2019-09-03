import { PreferenceContribution, PreferenceSchema, Domain, PreferenceConfiguration } from '@ali/ide-core-browser';
import { launchPreferencesSchema } from './launch-preferences';

@Domain(PreferenceContribution, PreferenceConfiguration)
export class LaunchPreferencesContribution implements PreferenceContribution, PreferenceConfiguration {
  schema: PreferenceSchema = launchPreferencesSchema;
  name = 'launch';
}
