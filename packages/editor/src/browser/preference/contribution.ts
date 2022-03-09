import { PreferenceContribution, Domain, ClientAppContribution } from '@opensumi/ide-core-browser';

import { editorPreferenceSchema } from './schema';

@Domain(PreferenceContribution, ClientAppContribution)
export class EditorPreferenceContribution implements PreferenceContribution {
  schema = editorPreferenceSchema;
}
