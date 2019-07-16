import { PreferenceScope } from '@ali/ide-core-common/lib/preferences/preference-scope';

const preferenceScopeProviderTokenMap = {};

preferenceScopeProviderTokenMap[PreferenceScope.Default] = Symbol('preferenceDefaultProvider');
preferenceScopeProviderTokenMap[PreferenceScope.User] = Symbol('preferenceUserProvider');
preferenceScopeProviderTokenMap[PreferenceScope.Workspace] = Symbol('preferenceWorkspaceProvider');
preferenceScopeProviderTokenMap[PreferenceScope.Folder] = Symbol('preferenceFolderProvider');

export { PreferenceScope, preferenceScopeProviderTokenMap };
