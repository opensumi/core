
import { Injectable, Autowired } from '@ali/common-di';
import {
  WorkspaceServerPath,
  KAITIAN_MUTI_WORKSPACE_EXT,
  getTemporaryWorkspaceFileUri,
  IWorkspaceServer,
  IWorkspaceService,
  WorkspaceData,
  WorkspaceInput,
} from '../common';
import {
  ClientAppConfigProvider,
  Deferred,
  ILogger,
  PreferenceService,
  PreferenceSchemaProvider,
  Event,
  MaybePromise,
  Emitter,
  DisposableCollection,
  PreferenceScope,
  IDisposable,
  Disposable,
  Command,
  AppConfig,
} from '@ali/ide-core-browser';
import { URI } from '@ali/ide-core-common';
import { FileStat } from '@ali/ide-file-service';
import { FileChangeEvent } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { WorkspacePreferences } from './workspace-preferences';
import * as jsoncparser from 'jsonc-parser';
import { IWindowService } from '@ali/ide-window';

@Injectable()
export class WorkspaceService implements IWorkspaceService {

  private _workspace: FileStat | undefined;

  private _roots: FileStat[] = [];
  private deferredRoots = new Deferred<FileStat[]>();

  @Autowired(WorkspaceServerPath)
  protected readonly workspaceServer: IWorkspaceServer;

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: IFileServiceClient;

  @Autowired(IWindowService)
  protected readonly windowService: IWindowService;

  @Autowired(ILogger)
  protected logger: ILogger;

  @Autowired(WorkspacePreferences)
  protected preferences: WorkspacePreferences;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(PreferenceSchemaProvider)
  protected readonly schemaProvider: PreferenceSchemaProvider;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(CorePreferences)
  corePreferences: CorePreferences;

  protected applicationName: string;

  public whenReady: Promise<void>;

  constructor() {
    this.whenReady = this.init();
  }

  public async init(): Promise<void> {
    // TODO 用户可配置
    this.applicationName = ClientAppConfigProvider.get().applicationName;
    const wpUriString = this.getDefaultWorkspacePath();

    await this.setFilesPreferences();

    if (wpUriString) {
      const wpStat = await this.toFileStat(wpUriString);
      await this.setWorkspace(wpStat);
      this.fileSystem.onFilesChanged((event) => {
        if (this._workspace && FileChangeEvent.isAffected(event, new URI(this._workspace.uri))) {
          this.updateWorkspace();
        }
      });
      this.preferences.onPreferenceChanged((event) => {
        const multiRootPrefName = 'workspace.supportMultiRootWorkspace';
        if (event.preferenceName === multiRootPrefName) {
          this.updateWorkspace();
        }
      });
    }
  }

  protected async setFilesPreferences() {
    const watchExcludeName = 'files.watcherExclude';
    const filesExcludeName = 'files.exclude';

    // TODO 尚不支持多 roots 更新
    await this.fileSystem.setWatchFileExcludes(this.getPreferenceFileExcludes(watchExcludeName));
    await this.fileSystem.setFilesExcludes(
      this.getPreferenceFileExcludes(filesExcludeName),
      this._roots.map((stat) => {
        return stat.uri;
      }),
    );
    this.corePreferences.onPreferenceChanged((e) => {
      if (e.preferenceName === watchExcludeName) {
        this.fileSystem.setWatchFileExcludes(this.getPreferenceFileExcludes(watchExcludeName));
      }
      if (e.preferenceName === filesExcludeName) {
        this.fileSystem.setFilesExcludes(
          this.getPreferenceFileExcludes(filesExcludeName),
          this._roots.map((stat) => {
            return stat.uri;
          }),
        );
      }
    });
  }

  protected getPreferenceFileExcludes(name: string): string[] {
    const excludes: string[] = [];
    const fileExcludes = this.corePreferences[name];
    for (const key of Object.keys(fileExcludes)) {
      if (fileExcludes[key]) {
        excludes.push(key);
      }
    }
    return excludes;
  }

  /**
   * 获取默认的workspace路径
   */
  protected getDefaultWorkspacePath(): string | undefined {
    if (this.appConfig.workspaceDir) {
      // 默认读取传入配置路径
      return URI.file(this.appConfig.workspaceDir).toString();
    }
  }

  get roots(): Promise<FileStat[]> {
    return this.deferredRoots.promise;
  }

  tryGetRoots(): FileStat[] {
    return this._roots;
  }

  get workspace(): FileStat | undefined {
    return this._workspace;
  }

  // 工作区改变事件
  protected readonly onWorkspaceChangeEmitter = new Emitter<FileStat[]>();
  get onWorkspaceChanged(): Event<FileStat[]> {
    return this.onWorkspaceChangeEmitter.event;
  }

  // 操作中的工作区改变事件
  protected readonly onWorkspaceLocationChangedEmitter = new Emitter<FileStat | undefined>();
  get onWorkspaceLocationChanged(): Event<FileStat | undefined> {
    return this.onWorkspaceLocationChangedEmitter.event;
  }

  protected readonly toDisposeOnWorkspace = new DisposableCollection();

  protected async setWorkspace(workspaceStat: FileStat | undefined): Promise<void> {
    if (FileStat.equals(this._workspace, workspaceStat)) {
      return;
    }
    this.toDisposeOnWorkspace.dispose();
    this._workspace = workspaceStat;
    if (this._workspace) {
      const uri = new URI(this._workspace.uri);
      // TODO: 避免重复监听
      this.toDisposeOnWorkspace.push(await this.fileSystem.watchFileChanges(uri));
    }
    this.updateTitle();
    await this.updateWorkspace();
  }

  protected async updateWorkspace(): Promise<void> {
    if (this._workspace) {
      this.toFileStat(this._workspace.uri).then((stat) => this._workspace = stat);
    }
    await this.updateRoots();
    this.watchRoots();
  }

  protected async updateRoots(): Promise<void> {
    const newRoots = await this.computeRoots();
    let rootsChanged = false;
    if (newRoots.length !== this._roots.length || newRoots.length === 0) {
      rootsChanged = true;
    } else {
      for (const newRoot of newRoots) {
        if (!this._roots.some((r) => r.uri === newRoot.uri)) {
          rootsChanged = true;
          break;
        }
      }
    }
    if (rootsChanged) {
      this._roots = newRoots;
      this.deferredRoots.resolve(this._roots); // in order to resolve first
      this.deferredRoots = new Deferred<FileStat[]>();
      this.deferredRoots.resolve(this._roots);
      this.onWorkspaceChangeEmitter.fire(this._roots);
    }
  }

  protected async computeRoots(): Promise<FileStat[]> {
    const roots: FileStat[] = [];
    if (this._workspace) {
      if (this._workspace.isDirectory) {
        return [this._workspace];
      }

      const workspaceData = await this.getWorkspaceDataFromFile();
      if (workspaceData) {
        for (const { path } of workspaceData.folders) {
          const valid = await this.toValidRoot(path);
          if (valid) {
            roots.push(valid);
          } else {
            roots.push({
              uri: path,
              lastModification: Date.now(),
              isDirectory: true,
            });
          }
        }
      }
    }
    return roots;
  }

  protected async getWorkspaceDataFromFile(): Promise<WorkspaceData | undefined> {
    if (this._workspace && await this.fileSystem.exists(this._workspace.uri)) {
      if (this._workspace.isDirectory) {
        return {
          folders: [{ path: this._workspace.uri }],
        };
      }
      const { stat, content } = await this.fileSystem.resolveContent(this._workspace.uri);
      const strippedContent = jsoncparser.stripComments(content);
      const data = jsoncparser.parse(strippedContent);
      if (data && WorkspaceData.is(data)) {
        return WorkspaceData.transformToAbsolute(data, stat);
      }
      this.logger.error(`Unable to retrieve workspace data from the file: '${this._workspace.uri}'. Please check if the file is corrupted.`);
    }
  }

  protected formatTitle(title?: string): string {
    const name = this.applicationName;
    return title ? `${title} — ${name}` : name;
  }

  // 更新页面Title
  protected updateTitle() {
    let title: string | undefined;
    if (this._workspace) {
      const uri = new URI(this._workspace.uri);
      const displayName = uri.displayName;
      if (!this._workspace.isDirectory &&
        (displayName.endsWith(`.${KAITIAN_MUTI_WORKSPACE_EXT}`) )) {
        title = displayName.slice(0, displayName.lastIndexOf('.'));
      } else {
        title = displayName;
      }
    }
    document.title = this.formatTitle(title);
  }

  async setMostRecentlyUsedWorkspace() {
    await this.workspaceServer.setMostRecentlyUsedWorkspace(this._workspace ? this._workspace.uri : '');
  }

  async recentWorkspaces(): Promise<string[]> {
    return this.workspaceServer.getRecentWorkspacePaths();
  }

  async recentCommands(): Promise<Command[]> {
    return this.workspaceServer.getRecentCommands();
  }

  async  setRecentWorkspace() {
    return this.workspaceServer.setMostRecentlyUsedWorkspace(this._workspace ? this._workspace.uri : '');
  }

  async  setRecentCommand(command: Command) {
    return this.workspaceServer.setMostRecentlyUsedCommand(command);
  }

  async setMostRecentlyOpenedFile(uri: string) {
    return this.workspaceServer.setMostRecentlyOpenedFile(uri);
  }

  async getMostRecentlyOpenedFiles() {
    return this.workspaceServer.getMostRecentlyOpenedFiles();
  }

  async getMostRecentlySearchWord() {
    return this.workspaceServer.getMostRecentlySearchWord();
  }

  async setMostRecentlySearchWord(word) {
    return this.workspaceServer.setMostRecentlySearchWord(word);
  }

  /**
   * 当已经存在打开的工作区时，返回true
   * @returns {boolean}
   */
  get opened(): boolean {
    return !!this._workspace;
  }

  /**
   * 当一个混合工作区打开时，返回 true
   * @returns {boolean}
   */
  get isMultiRootWorkspaceOpened(): boolean {
    return !!this.workspace && !this.workspace.isDirectory;
  }

  /**
   * 当前存在打开的工作区同时支持混合工作区时，返回true
   * @returns {boolean}
   */
  get isMultiRootWorkspaceEnabled(): boolean {
    return this.opened && this.preferences['workspace.supportMultiRootWorkspace'];
  }

  /**
   * 打开一个文件夹或创建一个工作区
   * @param {URI} uri
   * @param {WorkspaceInput} [options]
   * @memberof WorkspaceService
   */
  open(uri: URI, options?: WorkspaceInput): void {
    this.doOpen(uri, options);
  }

  /**
   * 需要判断是否在当前工作区打开窗口
   * 在这里传入的options优先级高于preference设置
   * @protected
   * @param {URI} uri
   * @param {WorkspaceInput} [options]
   * @returns {Promise<void>}
   * @memberof WorkspaceService
   */
  protected async doOpen(uri: URI, options?: WorkspaceInput): Promise<void> {
    const rootUri = uri.toString();
    const stat = await this.toFileStat(rootUri);
    if (stat) {
      await this.roots;
      const { preserveWindow } = {
        preserveWindow: this.preferences['workspace.preserveWindow'] || !this.opened,
        ...options,
      };
      await this.workspaceServer.setMostRecentlyUsedWorkspace(rootUri);
      if (preserveWindow) {
        this._workspace = stat;
      }
      this.openWindow(stat, { preserveWindow });
      return;
    }
    throw new Error('Invalid workspace root URI. Expected an existing directory location.');
  }

  /**
   * 为工作区设置根目录
   * @param uri
   */
  async addRoot(uri: URI): Promise<void> {
    await this.spliceRoots(this._roots.length, 0, uri);
  }

  /**
   * 工作区中移除对应根目录
   */
  async removeRoots(uris: URI[]): Promise<void> {
    if (!this.opened) {
      throw new Error('Folder cannot be removed as there is no active folder in the current workspace.');
    }
    if (this._workspace) {
      const workspaceData = await this.getWorkspaceDataFromFile();
      this._workspace = await this.writeWorkspaceFile(this._workspace,
        WorkspaceData.buildWorkspaceData(
          this._roots.filter((root) => uris.findIndex((u) => u.toString() === root.uri) < 0),
          workspaceData!.settings,
        ),
      );
    }
  }

  async spliceRoots(start: number, deleteCount?: number, ...rootsToAdd: URI[]): Promise<URI[]> {
    if (!this._workspace) {
      throw new Error('There is not active workspace');
    }
    const dedup = new Set<string>();
    const roots = this._roots.map((root) => (dedup.add(root.uri), root.uri));
    const toAdd: string[] = [];
    for (const root of rootsToAdd) {
      const uri = root.toString();
      if (!dedup.has(uri)) {
        dedup.add(uri);
        toAdd.push(uri);
      }
    }
    const toRemove = roots.splice(start, deleteCount || 0, ...toAdd);
    if (!toRemove.length && !toAdd.length) {
      return [];
    }
    if (this._workspace.isDirectory) {
      const untitledWorkspace = await this.getUntitledWorkspace();
      if (untitledWorkspace) {
        await this.save(untitledWorkspace);
      }
    }
    const currentData = await this.getWorkspaceDataFromFile();
    const newData = WorkspaceData.buildWorkspaceData(roots, currentData && currentData.settings);
    await this.writeWorkspaceFile(this._workspace, newData);
    return toRemove.map((root) => new URI(root));
  }

  protected async getUntitledWorkspace(): Promise<URI | undefined> {
    const home = await this.fileSystem.getCurrentUserHome();
    return home && getTemporaryWorkspaceFileUri(new URI(home.uri));
  }

  private async writeWorkspaceFile(workspaceFile: FileStat | undefined, workspaceData: WorkspaceData): Promise<FileStat | undefined> {
    if (workspaceFile) {
      const data = JSON.stringify(WorkspaceData.transformToRelative(workspaceData, workspaceFile));
      const edits = jsoncparser.format(data, undefined, { tabSize: 2, insertSpaces: true, eol: '' });
      const result = jsoncparser.applyEdits(data, edits);
      const stat = await this.fileSystem.setContent(workspaceFile, result);
      return stat;
    }
  }

  /**
   * 清理当前workspace
   */
  async close(): Promise<void> {
    this._workspace = undefined;
    this._roots.length = 0;

    await this.workspaceServer.setMostRecentlyUsedWorkspace('');
    this.reloadWindow();
  }

  /**
   * 验证给定的URI是否为有效根目录
   */
  protected async toValidRoot(uri: URI | string | undefined): Promise<FileStat | undefined> {
    const fileStat = await this.toFileStat(uri);
    if (fileStat && fileStat.isDirectory) {
      return fileStat;
    }
    return undefined;
  }

  /**
   * 返回文件的FileStat
   */
  protected async toFileStat(uri: URI | string | undefined): Promise<FileStat | undefined> {
    if (!uri) {
      return undefined;
    }
    let uriStr = uri.toString();
    try {
      if (uriStr.endsWith('/')) {
        uriStr = uriStr.slice(0, -1);
      }
      const fileStat = await this.fileSystem.getFileStat(uriStr);
      if (!fileStat) {
        return undefined;
      }
      return fileStat;
    } catch (error) {
      return undefined;
    }
  }

  protected openWindow(uri: FileStat, options?: WorkspaceInput): void {
    const workspacePath = new URI(uri.uri).path.toString();

    if (this.shouldPreserveWindow(options)) {
      this.reloadWindow();
    } else {
      try {
        this.openNewWindow(workspacePath);
      } catch (error) {
        // Fall back to reloading the current window in case the browser has blocked the new window
        this._workspace = uri;
        this.logger.error(error.toString());
      }
    }
  }

  protected reloadWindow(): void {

    window.location.reload(true);
  }

  protected openNewWindow(workspacePath: string): void {
    const url = new URL(window.location.href);
    url.hash = workspacePath;
    this.windowService.openNewWindow(url.toString());
  }

  protected shouldPreserveWindow(options?: WorkspaceInput): boolean {
    return options !== undefined && !!options.preserveWindow;
  }

  /**
   * 返回根目录下是否存在对应相对路径文件
   */
  async containsSome(paths: string[]): Promise<boolean> {
    await this.roots;
    if (this.opened) {
      for (const root of this._roots) {
        const uri = new URI(root.uri);
        for (const path of paths) {
          const fileUri = uri.resolve(path).toString();
          const exists = await this.fileSystem.exists(fileUri);
          if (exists) {
            return exists;
          }
        }
      }
    }
    return false;
  }

  get saved(): boolean {
    return !!this._workspace && !this._workspace.isDirectory;
  }

  /**
   * 存储工作区数据到文件中
   * @param uri URI or FileStat of the workspace file
   */
  async save(uri: URI | FileStat): Promise<void> {
    const uriStr = uri instanceof URI ? uri.toString() : uri.uri;
    if (!await this.fileSystem.exists(uriStr)) {
      await this.fileSystem.createFile(uriStr);
    }
    const workspaceData: WorkspaceData = { folders: [], settings: {} };
    if (!this.saved) {
      for (const p of Object.keys(this.schemaProvider.getCombinedSchema().properties)) {
        if (this.schemaProvider.isValidInScope(p, PreferenceScope.Folder)) {
          continue;
        }
        const preferences = this.preferenceService.inspect(p);
        if (preferences && preferences.workspaceValue) {
          workspaceData.settings![p] = preferences.workspaceValue;
        }
      }
    }
    let stat = await this.toFileStat(uriStr);
    Object.assign(workspaceData, await this.getWorkspaceDataFromFile());
    stat = await this.writeWorkspaceFile(stat, WorkspaceData.buildWorkspaceData(this._roots, workspaceData ? workspaceData.settings : undefined));
    await this.workspaceServer.setMostRecentlyUsedWorkspace(uriStr);
    await this.setWorkspace(stat);
    this.onWorkspaceLocationChangedEmitter.fire(stat);
  }

  protected readonly rootWatchers = new Map<string, IDisposable>();

  // 监听所有根路径变化
  protected async watchRoots(): Promise<void> {
    const rootUris = new Set(this._roots.map((r) => r.uri));
    for (const [uri, watcher] of this.rootWatchers.entries()) {
      if (!rootUris.has(uri)) {
        watcher.dispose();
      }
    }
    for (const root of this._roots) {
      this.watchRoot(root);
    }
  }

  // 监听根路径变化
  protected async watchRoot(root: FileStat): Promise<void> {
    const uriStr = root.uri;
    if (this.rootWatchers.has(uriStr)) {
      return;
    }
    const watcher = this.fileSystem.watchFileChanges(new URI(root.uri));
    this.rootWatchers.set(uriStr, Disposable.create(() => {
      watcher.then((disposable) => disposable.dispose());
      this.rootWatchers.delete(uriStr);
    }));
  }

  /**
   * 根据给定的uri获取其根节点
   * 如果不指定uri，则获取默认的根节点
   * @param uri
   */
  getWorkspaceRootUri(uri: URI | undefined): URI | undefined {
    if (!uri) {
      const root = this.tryGetRoots()[0];
      if (root) {
        return new URI(root.uri);
      }
      return undefined;
    }
    const rootUris: URI[] = [];
    for (const root of this.tryGetRoots()) {
      const rootUri = new URI(root.uri);
      if (rootUri && rootUri.isEqualOrParent(uri)) {
        rootUris.push(rootUri);
      }
    }
    return rootUris.sort((r1, r2) => r2.toString().length - r1.toString().length)[0];
  }

  /**
   * 获取相对路径
   * @param pathOrUri
   * @param includeWorkspaceFolder
   */
  async asRelativePath(pathOrUri: string | URI, includeWorkspaceFolder?: boolean) {
    let path: string | undefined;
    if (typeof pathOrUri === 'string') {
      path = pathOrUri;
    } else if (typeof pathOrUri !== 'undefined') {
      path = pathOrUri.toString();
    }
    if (!path) {
      return path;
    }
    const roots = await this.roots;
    if (includeWorkspaceFolder && this.isMultiRootWorkspaceOpened) {
      const workspace = await this.workspace;
      if (workspace) {
        roots.push(workspace);
      }
    }
    for (const root of roots) {
      const rootUri = root.uri;
      const isRelative = path && path.indexOf(rootUri) >= 0;
      if (isRelative) {
        return path.replace(rootUri + '/', '');
      }
    }
    return path;
  }
}
