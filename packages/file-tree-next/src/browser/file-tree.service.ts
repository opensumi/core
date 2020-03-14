import { action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import {
  CommandService,
  IContextKeyService,
  URI,
  Uri,
  Emitter,
  EDITOR_COMMANDS,
  AppConfig,
} from '@ali/ide-core-browser';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { IFileTreeAPI } from '../common';
import { IFileServiceWatcher } from '@ali/ide-file-service/lib/common';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';
import { Tree, ITree } from '@ali/ide-components';
import { Directory } from './file-tree-nodes';

@Injectable()
export class FileTreeService extends Tree {

  private _workspaceRoot: FileStat | undefined;

  private fileServiceWatchers: {
    [uri: string]: IFileServiceWatcher,
  } = {};

  @Autowired(AppConfig)
  private readonly config: AppConfig;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  private _contextMenuContextKeyService: IContextKeyService;

  private statusChangeEmitter = new Emitter<Uri[]>();

  get onStatusChange() {
    return this.statusChangeEmitter.event;
  }

  get workpsaceRoot() {
    if (this._workspaceRoot) {
      return new URI(this._workspaceRoot.uri);
    }
    return URI.file(this.config.workspaceDir);
  }

  constructor() {
    super();
  }

  async init() {
    await this.workspaceService.roots;

    this._workspaceRoot = this.workspaceService.workspace;

    this.workspaceService.onWorkspaceChanged(async () => {
      this._workspaceRoot = this.workspaceService.workspace;
      this.dispose();
    });
  }

  async resolveChildren(parent?: Directory) {
    if (!parent) {
      // 加载根目录
      await this.workspaceService.roots;
      if (this.workspaceService.workspace) {
        return await this.fileTreeAPI.resolveChildren(this as ITree, this.workspaceService.workspace);
      }
      return ;
    } else {
      // 加载子目录
      return await this.fileTreeAPI.resolveChildren(this as ITree, parent.uri.toString());
    }
  }

  dispose() {
    super.dispose();
    for (const watcher of Object.keys(this.fileServiceWatchers)) {
      this.fileServiceWatchers[watcher].dispose();
    }
  }

  get contextMenuContextKeyService() {
    if (!this._contextMenuContextKeyService) {
      this._contextMenuContextKeyService = this.contextKeyService.createScoped();
    }
    return this._contextMenuContextKeyService;
  }

  // @memoize get contributedContextMenu(): IContextMenu {
  //   return this.registerDispose(this.ctxMenuService.createMenu({
  //     id: MenuId.ExplorerContext,
  //     contextKeyService: this.contextMenuContextKeyService,
  //   }));
  // }

  get isMutiWorkspace(): boolean {
    return !!this.workspaceService.workspace && !this.workspaceService.workspace.isDirectory;
  }

  getDisplayName(uri: URI) {
    return this.workspaceService.getWorkspaceName(uri);
  }

  /**
   * 折叠所有节点
   */
  @action
  collapseAll() {
    // todo
  }

  /**
   * 刷新所有节点
   */
  @action
  async refresh() {
   // todo
  }

  // @OnEvent(ResourceLabelOrIconChangedEvent)
  // onResourceLabelOrIconChangedEvent(e: ResourceLabelOrIconChangedEvent) {
  //   // labelService发生改变时，更新icon和名称
  //   this.updateItemMeta(e.payload);
  // }

  @action
  updateItemMeta() {
    // todo
  }

  /**
   * 打开文件
   * @param uri
   */
  openFile(uri: URI) {
    // 当打开模式为双击同时预览模式生效时，默认单击为预览文件
    const preview = this.corePreferences['editor.previewMode'];
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, preview });
  }

  /**
   * 打开并固定文件
   * @param uri
   */
  openAndFixedFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, preview: false });
  }

  /**
   * 在侧边栏打开文件
   * @param {URI} uri
   * @memberof FileTreeService
   */
  openToTheSide(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, split: 4 /** right */ });
  }

  /**
   * 比较选中的两个文件
   * @param original
   * @param modified
   */
  compare(original: URI, modified: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.COMPARE.id, {
      original,
      modified,
    });
  }
}
