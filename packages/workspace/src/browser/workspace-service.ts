import * as jsoncparser from 'jsonc-parser';

import { Injectable, Autowired } from '@opensumi/di';
import {
  Deferred,
  ILogger,
  PreferenceService,
  PreferenceSchemaProvider,
  Event,
  Emitter,
  DisposableCollection,
  PreferenceScope,
  IDisposable,
  Disposable,
  AppConfig,
  IClientApp,
  IWindowService,
} from '@opensumi/ide-core-browser';
import { URI, StorageProvider, IStorage, STORAGE_NAMESPACE, localize, formatLocalize } from '@opensumi/ide-core-common';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { FileStat } from '@opensumi/ide-file-service';
import { FileChangeEvent } from '@opensumi/ide-file-service/lib/common';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

import {
  DEFAULT_WORKSPACE_SUFFIX_NAME,
  IWorkspaceService,
  WorkspaceData,
  WorkspaceInput,
  WORKSPACE_USER_STORAGE_FOLDER_NAME,
  UNTITLED_WORKSPACE,
} from '../common';

import { WorkspacePreferences } from './workspace-preferences';

@Injectable()
export class WorkspaceService implements IWorkspaceService {
  private _workspace: FileStat | undefined;

  private _roots: FileStat[] = [];
  private deferredRoots = new Deferred<FileStat[]>();

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

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

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  private recentGlobalStorage: IStorage;

  @Autowired(IClientApp)
  private readonly clientApp: IClientApp;

  get workspaceSuffixName() {
    return this.appConfig.workspaceSuffixName || DEFAULT_WORKSPACE_SUFFIX_NAME;
  }

  protected applicationName: string;

  private _whenReady: Deferred<void> = new Deferred();

  protected readonly toDisposableCollection: DisposableCollection = new DisposableCollection();

  // 映射工作区显示的文字信息
  private workspaceToName = {};

  public init() {
    this.doInit();
  }

  public async initFileServiceExclude() {
    await this.setFileServiceExcludes();
  }

  public get whenReady() {
    return this._whenReady.promise;
  }

  protected async doInit(): Promise<void> {
    // 这里的 `appName` 存在默认值
    this.applicationName = this.appConfig.appName!;
    const wpUriString = this.getDefaultWorkspacePath();

    this.listenPreference();

    if (wpUriString) {
      const wpStat = await this.toFileStat(wpUriString);
      await this.setWorkspace(wpStat);
      this.toDisposableCollection.push(
        this.fileServiceClient.onFilesChanged((event) => {
          if (this._workspace && FileChangeEvent.isAffected(event, new URI(this._workspace.uri))) {
            this.updateWorkspace();
          }
        }),
      );
    } else {
      // 处理空工作区情况
      this.deferredRoots.resolve([]);
    }

    this._whenReady.resolve();
  }

  protected getTemporaryWorkspaceFileUri(home: URI): URI {
    return home
      .resolve(this.appConfig.storageDirName || WORKSPACE_USER_STORAGE_FOLDER_NAME)
      .resolve(`${UNTITLED_WORKSPACE}.${this.workspaceSuffixName}`)
      .withScheme('file');
  }

  protected listenPreference() {
    const watchExcludeName = 'files.watcherExclude';
    const filesExcludeName = 'files.exclude';
    const multiRootPrefName = 'workspace.supportMultiRootWorkspace';

    this.toDisposableCollection.push(
      this.preferenceService.onPreferenceChanged((e) => {
        // 工作区切换到多工作区时，可能会触发一次所有工作区配置的 Changed
        if (e.preferenceName === watchExcludeName) {
          this.fileServiceClient.setWatchFileExcludes(this.getFlattenExcludes(watchExcludeName));
        } else if (e.preferenceName === filesExcludeName) {
          this.fileServiceClient
            .setFilesExcludes(
              this.getFlattenExcludes(filesExcludeName),
              this._roots.map((stat) => stat.uri),
            )
            .then(() => {
              // 通知目录树更新
              this.onWorkspaceFileExcludeChangeEmitter.fire();
            });
        } else if (e.preferenceName === multiRootPrefName) {
          this.updateWorkspace();
        }
      }),
    );
  }

  protected async setFileServiceExcludes() {
    const watchExcludeName = 'files.watcherExclude';
    const filesExcludeName = 'files.exclude';

    await this.preferenceService.ready;
    await this.fileServiceClient.setWatchFileExcludes(this.getFlattenExcludes(watchExcludeName));
    await this.fileServiceClient.setFilesExcludes(
      this.getFlattenExcludes(filesExcludeName),
      this._roots.map((stat) => stat.uri),
    );
    this.onWorkspaceFileExcludeChangeEmitter.fire();
  }

  protected getFlattenExcludes(name: string): string[] {
    const excludes: string[] = [];
    const fileExcludes = this.preferenceService.get<any>(name);
    if (fileExcludes) {
      for (const key of Object.keys(fileExcludes)) {
        if (fileExcludes[key]) {
          excludes.push(key);
        }
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
      let path: string;
      try {
        // 尝试使用 Windows 下带盘符的路径进行解析
        path = new URL(URI.file(this.appConfig.workspaceDir).codeUri.fsPath).toString();
      } catch (e) {
        // 解析失败时仍然使用非 Windows 环境下的解析方式
        path = URI.file(this.appConfig.workspaceDir).toString();
      }
      return path;
    } else {
      return undefined;
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

  protected readonly onWorkspaceFileExcludeChangeEmitter = new Emitter<void>();
  get onWorkspaceFileExcludeChanged(): Event<void> {
    return this.onWorkspaceFileExcludeChangeEmitter.event;
  }

  // 操作中的工作区改变事件
  protected readonly onWorkspaceLocationChangedEmitter = new Emitter<FileStat | undefined>();
  get onWorkspaceLocationChanged(): Event<FileStat | undefined> {
    return this.onWorkspaceLocationChangedEmitter.event;
  }

  protected readonly toDisposeOnWorkspace = new DisposableCollection();

  public async setWorkspace(workspaceStat: FileStat | undefined): Promise<void> {
    if (FileStat.equals(this._workspace, workspaceStat)) {
      return;
    }
    this.toDisposeOnWorkspace.dispose();
    this._workspace = workspaceStat;
    if (this._workspace) {
      const uri = new URI(this._workspace.uri);
      this.toDisposeOnWorkspace.push(await this.fileServiceClient.watchFileChanges(uri));
    }
    this.updateTitle();
    await this.updateWorkspace();
  }

  protected async updateWorkspace(): Promise<void> {
    if (this._workspace) {
      this.toFileStat(this._workspace.uri).then((stat) => (this._workspace = stat));
      this.setMostRecentlyUsedWorkspace(this._workspace.uri);
    }
    await this.updateRoots();
    if (!this._workspace?.isDirectory) {
      // 工作区模式才需要额外监听根目录，否则会出现重复监听问题
      this.watchRoots();
    }
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
      // 重新根据工作区Roots设置 fileExclude 及 watchExclude
      this.setFileServiceExcludes();
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
        for (let { path } of workspaceData.folders) {
          if (path === '.') {
            path = new URI(this._workspace.uri).parent.toString();
          }
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
    if (this._workspace && (await this.fileServiceClient.access(this._workspace.uri))) {
      if (this._workspace.isDirectory) {
        return {
          folders: [{ path: this._workspace.uri }],
        };
      }
      const { content } = await this.fileServiceClient.resolveContent(this._workspace.uri);
      const strippedContent = jsoncparser.stripComments(content);
      const data = jsoncparser.parse(strippedContent);
      if (data && WorkspaceData.is(data)) {
        const stat = await this.fileServiceClient.getFileStat(this._workspace.uri);
        return WorkspaceData.transformToAbsolute(data, stat);
      }
      this.logger.error(
        `Unable to retrieve workspace data from the file: '${this._workspace.uri}'. Please check if the file is corrupted.`,
      );
    }
  }

  protected formatTitle(title?: string): string {
    const name = this.applicationName;

    let documentTitle = title ? `${title} — ${name}` : name;
    if (this.appConfig.extensionDevelopmentHost) {
      documentTitle = `[${localize('workspace.development.title')}] ${documentTitle}`;
    }
    return documentTitle;
  }

  // 更新页面Title
  protected updateTitle() {
    // 是否允许按照 workspace dir 修改 document#title
    if (!this.appConfig.allowSetDocumentTitleFollowWorkspaceDir) {
      return;
    }

    let title: string | undefined;
    if (this._workspace) {
      const uri = new URI(this._workspace.uri);
      const displayName = uri.displayName;
      if (!this._workspace.isDirectory && displayName.endsWith(`.${this.workspaceSuffixName}`)) {
        title = formatLocalize(
          'file.workspace.defaultWorkspaceTip',
          displayName.slice(0, displayName.lastIndexOf('.')),
        );
      } else {
        title = displayName;
      }
    }
    document.title = this.formatTitle(title);
  }

  async getMostRecentlyUsedWorkspace(): Promise<string | undefined> {
    await this.getGlobalRecentStorage();
    const recentWorkspaces: string[] = (await this.recentGlobalStorage.get<string[]>('RECENT_WORKSPACES')) || [];
    return recentWorkspaces[0];
  }

  async setMostRecentlyUsedWorkspace(path: string) {
    await this.getGlobalRecentStorage();
    const recentWorkspaces: string[] = (await this.recentGlobalStorage.get<string[]>('RECENT_WORKSPACES')) || [];
    recentWorkspaces.unshift(path);
    await this.recentGlobalStorage.set('RECENT_WORKSPACES', Array.from(new Set(recentWorkspaces)));
  }

  async getMostRecentlyUsedWorkspaces(): Promise<string[]> {
    await this.getGlobalRecentStorage();
    const recentWorkspaces: string[] = (await this.recentGlobalStorage.get<string[]>('RECENT_WORKSPACES')) || [];
    return recentWorkspaces;
  }

  async getMostRecentlyUsedCommands(): Promise<string[]> {
    await this.getGlobalRecentStorage();
    const recentCommands: string[] = (await this.recentGlobalStorage.get<string[]>('RECENT_COMMANDS')) || [];
    return recentCommands;
  }

  async setMostRecentlyUsedCommand(commandId: string) {
    await this.getGlobalRecentStorage();
    const recentCommands: string[] = (await this.recentGlobalStorage.get<string[]>('RECENT_COMMANDS')) || [];
    const commandIndex = recentCommands.indexOf(commandId);
    // 重新排到队列顶部
    if (commandIndex > 0) {
      recentCommands.splice(commandIndex, 1);
    }
    recentCommands.unshift(commandId);
    await this.recentGlobalStorage.set('RECENT_COMMANDS', recentCommands);
  }

  private async getGlobalRecentStorage() {
    this.recentGlobalStorage =
      this.recentGlobalStorage || (await this.storageProvider(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA));
    await this.recentGlobalStorage.whenReady;
    return this.recentGlobalStorage;
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
  async open(uri: URI, options?: WorkspaceInput) {
    await this.doOpen(uri, options);
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
    await this.spliceRoots(this._roots.length, 0, {}, uri);
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
      this._workspace = await this.writeWorkspaceFile(
        this._workspace,
        WorkspaceData.buildWorkspaceData(
          this._roots.filter((root) => uris.findIndex((u) => u.toString() === root.uri) < 0),
          workspaceData!.settings,
        ),
      );
    }
  }

  async spliceRoots(
    start: number,
    deleteCount = 0,
    workspaceToName: { [key: string]: string } = {},
    ...rootsToAdd: URI[]
  ): Promise<URI[]> {
    if (!this._workspace) {
      throw new Error('There is not active workspace');
    }
    const dedup = new Set<string>();
    const roots = this._roots.map((root) => (dedup.add(root.uri), root.uri));
    const toAdd: string[] = [];
    // 更新工作区映射
    for (const uri of Object.keys(workspaceToName)) {
      this.workspaceToName[new URI(uri).toString()] = workspaceToName[uri];
    }
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

  public getWorkspaceName(uri: URI) {
    return (
      this.workspaceToName[uri.toString()] || this.workspaceToName[uri.toString() + Path.separator] || uri.displayName
    );
  }

  protected async getUntitledWorkspace(): Promise<URI | undefined> {
    const home = await this.fileServiceClient.getCurrentUserHome();
    return home && this.getTemporaryWorkspaceFileUri(new URI(home.uri));
  }

  private async writeWorkspaceFile(
    workspaceFile: FileStat | undefined,
    workspaceData: WorkspaceData,
  ): Promise<FileStat | undefined> {
    if (workspaceFile) {
      const data = JSON.stringify(WorkspaceData.transformToRelative(workspaceData, workspaceFile));
      const edits = jsoncparser.format(data, undefined, { tabSize: 2, insertSpaces: true, eol: '' });
      const result = jsoncparser.applyEdits(data, edits);
      const stat = await this.fileServiceClient.setContent(workspaceFile, result);
      if (!stat) {
        return undefined;
      }
      return stat;
    }
  }

  /**
   * 清理当前workspace
   */
  async close(): Promise<void> {
    this._workspace = undefined;
    this._roots.length = 0;
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
      const fileStat = await this.fileServiceClient.getFileStat(uriStr);
      if (!fileStat) {
        return undefined;
      }
      return fileStat;
    } catch (error) {
      return undefined;
    }
  }

  protected openWindow(fileStat: FileStat, options?: WorkspaceInput): void {
    const workspacePath = new URI(fileStat.uri).path.toString();

    if (this.shouldPreserveWindow(options)) {
      this.reloadWindow();
    } else {
      try {
        this.openNewWindow(workspacePath);
      } catch (error) {
        // Fall back to reloading the current window in case the browser has blocked the new window
        this._workspace = fileStat;
        this.logger.error(error.toString());
      }
    }
  }

  protected reloadWindow(): void {
    this.clientApp.fireOnReload(true);
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
          const exists = await this.fileServiceClient.access(fileUri);
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
    if (!(await this.fileServiceClient.access(uriStr))) {
      await this.fileServiceClient.createFile(uriStr);
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
    stat = await this.writeWorkspaceFile(
      stat,
      WorkspaceData.buildWorkspaceData(this._roots, workspaceData ? workspaceData.settings : undefined),
    );
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
    const watcher = this.fileServiceClient.watchFileChanges(new URI(root.uri));
    this.rootWatchers.set(
      uriStr,
      Disposable.create(() => {
        watcher.then((disposable) => disposable.dispose());
        this.rootWatchers.delete(uriStr);
      }),
    );
  }

  /**
   * 根据给定的uri获取其根节点
   * 如果不指定uri，则获取默认的根节点
   * @param uri
   */
  getWorkspaceRootUri(uri: URI | undefined): URI | undefined {
    // 获取非file协议文件的根目录，默认返回第一个根目录或undefined
    if (!uri || uri.scheme !== 'file') {
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
    // path 为 uri.path 非 uri.toString()
    let path: string | undefined;
    if (typeof pathOrUri === 'string') {
      path = pathOrUri;
    } else if (typeof pathOrUri !== 'undefined') {
      path = pathOrUri.codeUri.fsPath;
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
      const rootPath = new URI(root.uri).codeUri.fsPath;
      const isRelative = path && path.indexOf(rootPath) >= 0;
      if (isRelative) {
        if (path === rootPath) {
          return '';
        }
        if (rootPath.slice(-1) === '/') {
          return decodeURI(path.replace(rootPath, ''));
        }
        return decodeURI(path.replace(rootPath + '/', ''));
      }
    }
    return decodeURI(path);
  }

  dispose() {
    this.toDisposableCollection.dispose();
  }
}
