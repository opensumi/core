import { PreferenceContribution, Domain, ClientAppContribution } from '@ali/ide-core-browser';
import { editorPreferenceSchema } from './schema';

@Domain(PreferenceContribution, ClientAppContribution)
export class EditorPreferenceContribution implements PreferenceContribution {
  schema = editorPreferenceSchema;
}
