import { Domain } from './';
import { PreferenceContribution, PreferenceSchema } from './preferences';
import { corePreferenceSchema } from './core-preferences';

@Domain(PreferenceContribution)
export class CoreContribution implements PreferenceContribution {
  schema: PreferenceSchema = corePreferenceSchema;
}
