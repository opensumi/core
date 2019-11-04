import { Autowired, Injectable } from '@ali/common-di';
import { URI } from '@ali/ide-core-browser';
import { PreferenceScope } from '@ali/ide-core-browser/lib/preferences';
import { IWorkspaceService, WorkspaceData } from '@ali/ide-workspace';
import { AbstractResourcePreferenceProvider } from './abstract-resource-preference-provider';

@Injectable()
export class WorkspaceFilePreferenceProviderOptions {
  workspaceUri: URI;
}

export const WorkspaceFilePreferenceProviderFactory = Symbol('WorkspaceFilePreferenceProviderFactory');
export type WorkspaceFilePreferenceProviderFactory = (options: WorkspaceFilePreferenceProviderOptions) => WorkspaceFilePreferenceProvider;

@Injectable()
export class WorkspaceFilePreferenceProvider extends AbstractResourcePreferenceProvider {

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(WorkspaceFilePreferenceProviderOptions)
  protected readonly options: WorkspaceFilePreferenceProviderOptions;

  protected getUri(): URI {
    return this.options.workspaceUri;
  }

  protected parse(content: string): any {
    const data = super.parse(content);
    if (WorkspaceData.is(data)) {
      return data.settings || {};
    }
    return {};
  }

  protected getPath(preferenceName: string): string[] {
    return ['settings', preferenceName];
  }

  protected getScope(): PreferenceScope {
    return PreferenceScope.Workspace;
  }

  getDomain(): string[] {
    // workspace file is treated as part of the workspace
    return this.workspaceService.tryGetRoots().map((r) => r.uri).concat([this.options.workspaceUri.toString()]);
  }
}
