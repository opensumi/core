import { PreferenceContribution, Domain, ClientAppContribution } from '@ide-framework/ide-core-browser';
import { editorPreferenceSchema } from './schema';

@Domain(PreferenceContribution, ClientAppContribution)
export class EditorPreferenceContribution implements PreferenceContribution {
  schema = editorPreferenceSchema;
}
