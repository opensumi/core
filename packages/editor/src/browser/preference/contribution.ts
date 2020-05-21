import { PreferenceContribution, Domain } from '@ali/ide-core-browser';
import { editorPreferenceSchema } from './schema';

@Domain(PreferenceContribution)
export class EditorPreferenceContribution implements PreferenceContribution {
  schema = editorPreferenceSchema;
}
