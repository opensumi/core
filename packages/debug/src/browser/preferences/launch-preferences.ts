import { PreferenceSchema } from '@ali/ide-core-browser';
import { launchSchemaUri } from '../debug-schema-updater';

export const launchPreferencesSchema: PreferenceSchema = {
  type: 'object',
  scope: 'resource',
  properties: {
    'launch': {
      $ref: launchSchemaUri,
      description: "Global debug launch configuration. Should be used as an alternative to 'launch.json' that is shared across workspaces",
      defaultValue: { configurations: [], compounds: [] },
    },
  },
};
