import { Injector } from '@ali/common-di';
import { launchSchemaId } from '../debug-schema-updater';
import { LaunchFolderPreferenceProvider } from './launch-folder-preference-provider';
import { PreferenceContribution, PreferenceSchema, PreferenceConfiguration} from '@ali/ide-core-browser;
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
    useValue: { schema: launchPreferencesSchema },
  });
  injector.addProviders({
    token: PreferenceConfiguration,
    useValue: { name: 'launch' },
  });
  bind(PreferenceContribution).toConstantValue({ schema: launchPreferencesSchema });
  bind(FolderPreferenceProvider).to(LaunchFolderPreferenceProvider).inTransientScope().whenTargetNamed('launch');
  bind(PreferenceConfiguration).toConstantValue({ name: 'launch' });
}
