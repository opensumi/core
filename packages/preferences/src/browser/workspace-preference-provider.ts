import { Injectable, Autowired } from '@ali/common-di';
import { URI, DisposableCollection } from '@ali/ide-core-browser';
import { PreferenceScope, PreferenceProvider } from '@ali/ide-core-browser/lib/preferences';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FoldersPreferencesProvider, FolderPreferenceCollectionProvider } from './folders-preferences-provider';

@Injectable()
export class WorkspacePreferenceProvider extends PreferenceProvider {

  public name: 'workspace';

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Folder })
  protected readonly folderPreferenceProvider: FoldersPreferencesProvider;

  constructor() {
    super();
    this.init();
  }

  protected async init(): Promise<void> {
    this._ready.resolve();
    this.ensureDelegateUpToDate();
    this.workspaceService.onWorkspaceLocationChanged(() => this.ensureDelegateUpToDate());
  }

  getConfigUri(resourceUri: string | undefined = this.ensureResourceUri()): URI | undefined {
    const delegate = this.delegate;
    return delegate && delegate.getConfigUri(resourceUri);
  }

  protected _delegate: FolderPreferenceCollectionProvider | undefined;
  protected get delegate(): FolderPreferenceCollectionProvider | undefined {
    if (!this._delegate) {
      this.ensureDelegateUpToDate();
    }
    return this._delegate;
  }

  protected readonly toDisposeOnEnsureDelegateUpToDate = new DisposableCollection();
  protected ensureDelegateUpToDate(): void {
    const delegate = this.createDelegate();
    if (this._delegate !== delegate) {
      this.toDisposeOnEnsureDelegateUpToDate.dispose();
      this.toDispose.push(this.toDisposeOnEnsureDelegateUpToDate);

      this._delegate = delegate;

      if (delegate) {
        this.toDisposeOnEnsureDelegateUpToDate.pushAll([
          delegate.onDidPreferencesChanged((changes) => this.emitPreferencesChangedEvent(changes)),
        ]);
      }
    }
  }

  protected createDelegate(): FolderPreferenceCollectionProvider  | undefined {
    const workspace = this.workspaceService.workspace;
    if (!workspace) {
      return undefined;
    }
    // TODO: vscode中，在多workspace下，workspace scope 的 preference 会由单独的workspace.json
    // 加上一段更为复杂的逻辑来提供。
    // 此处我们不这么认为，永远取 folderPreferenceProvider 中和当前 workspace 相同的作为 delegate

    return this.folderPreferenceProvider.getDefaultFolderProvider();
  }

  doResolve<T>(preferenceName: string, resourceUri: string | undefined = this.ensureResourceUri(), language?: string): { value?: T, configUri?: URI } {
    const delegate = this.delegate;
    return delegate ? delegate.doResolve<T>(preferenceName, resourceUri, language) : {};
  }

  getPreferences(resourceUri: string | undefined = this.ensureResourceUri(), language?: string): { [p: string]: any } {
    const delegate = this.delegate;
    return delegate ? delegate.getPreferences(language) : {};
  }

  getLanguagePreferences(resourceUri: string | undefined = this.ensureResourceUri()) {
    const delegate = this.delegate;
    return delegate ? delegate.getLanguagePreferences() : {};
  }

  async doSetPreference(preferenceName: string, value: any, resourceUri: string | undefined = this.ensureResourceUri(), language?: string): Promise<boolean> {
    const delegate = this.delegate;
    if (delegate) {
      return delegate.doSetPreference(preferenceName, value, resourceUri, language);
    }
    return false;
  }

  protected ensureResourceUri(): string | undefined {
    if (this.workspaceService.workspace && !this.workspaceService.isMultiRootWorkspaceOpened) {
      return this.workspaceService.workspace.uri;
    }
    return undefined;
  }

}
