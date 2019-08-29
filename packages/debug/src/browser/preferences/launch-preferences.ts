import { Injector } from '@ali/common-di';
import { PreferenceContribution, PreferenceSchema } from '@ali/ide-core-browser';
import { launchSchemaId } from '../debug-schema-updater';
import { LaunchFolderPreferenceProvider } from './launch-folder-preference-provider';
import { FolderPreferenceProvider } from '@ali/ide-preferences/lib/browser/folder-preference-provider';

export const launchPreferencesSchema: PreferenceSchema = {
    type: 'object',
    scope: 'resource',
    properties: {
        'launch': {
            $ref: launchSchemaId,
            description: "Global debug launch configuration. Should be used as an alternative to 'launch.json' that is shared across workspaces",
            defaultValue: { configurations: [], compounds: [] },
        },
    },
};

export function injectLaunchPreferences(injector: Injector): void {
  injector.addProviders({
    token: PreferenceContribution,
    useValue: { schema: launchPreferencesSchema },
  });
  injector.addProviders({
    token: FolderPreferenceProvider,
    useClass: LaunchFolderPreferenceProvider,
  });
  injector.addProviders({
    // TODO: 待DI实现tag机制
    token: FolderPreferenceProvider,
    tag: 'launch',
    useValue: { name: 'launch' },
  });
}
