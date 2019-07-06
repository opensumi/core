import { PreferenceScope } from '@ali/ide-core-common/lib/preferences/preference-scope';

const preferenceScopeDomainMap = {};

preferenceScopeDomainMap[PreferenceScope.Default] = 'preferenceDefaultDomain';
preferenceScopeDomainMap[PreferenceScope.User] = 'preferenceUserDomain';
preferenceScopeDomainMap[PreferenceScope.Workspace] = 'preferenceWorkspaceDomain';
preferenceScopeDomainMap[PreferenceScope.Folder] = 'preferenceFolderDomain';

export { PreferenceScope, preferenceScopeDomainMap };
