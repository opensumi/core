import { Injector } from '@ali/common-di';
import {
  createPreferenceProxy,
  PreferenceProxy,
  PreferenceService,
  PreferenceSchema,
  PreferenceContribution,
} from '@ali/ide-core-browser';

export const workspacePreferenceSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    'workspace.preserveWindow': {
      description: 'Enable opening workspaces in current window',
      type: 'boolean',
      default: false,
    },
    'workspace.supportMultiRootWorkspace': {
      description: 'Enable the multi-root workspace support to test this feature internally',
      type: 'boolean',
      default: false,
    },
  },
};

export interface WorkspaceConfiguration {
  'workspace.preserveWindow': boolean;
  'workspace.supportMultiRootWorkspace': boolean;
}

export const WorkspacePreferences = Symbol('WorkspacePreferences');
export type WorkspacePreferences = PreferenceProxy<WorkspaceConfiguration>;

export function createWorkspacePreferencesProvider(preferences: PreferenceService): {
  token: any,
  useValue: PreferenceProxy<WorkspaceConfiguration>,
} {
  return {
    token: WorkspacePreferences,
    useValue: createPreferenceProxy(preferences, workspacePreferenceSchema),
  };
}

export function createWorkspacePreferenceContributionProvider() {
  return {
    token: PreferenceContribution,
    useValue: { schema: workspacePreferenceSchema },
  };
}

export function injectWorkspacePreferences(inject: Injector) {
  const preferences = inject.get(PreferenceService);
  inject.addProviders(createWorkspacePreferencesProvider(preferences));
  inject.addProviders(createWorkspacePreferenceContributionProvider());
}
