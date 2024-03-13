import { Domain, PreferenceContribution } from '@opensumi/ide-core-browser';

import { editorPreferenceSchema } from './schema';

@Domain(PreferenceContribution)
export class EditorPreferenceContribution implements PreferenceContribution {
  schema = editorPreferenceSchema;
}
