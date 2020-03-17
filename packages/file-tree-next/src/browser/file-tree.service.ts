import { action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import {
  CommandService,
  IContextKeyService,
  URI,
  EDITOR_COMMANDS,
  AppConfig,
} from '@ali/ide-core-browser';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { IFileTreeAPI } from '../common';
import { IFileServiceWatcher } from '@ali/ide-file-service/lib/common';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';
import { Tree, ITree } from '@ali/ide-components';
import { Directory, File } from './file-tree-nodes';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';
import { LabelService } from '@ali/ide-core-browser/lib/services';

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

  @Autowired(LabelService)
  public readonly labelService: LabelService;

  @Autowired(FileTreeDecorationService)
  public readonly decorationService: FileTreeDecorationService;

  private _contextMenuContextKeyService: IContextKeyService;

  private cacheNodesMap: Map<string, File | Directory> = new Map();

  get workspaceRootFileStat() {
    return this._workspaceRoot;
  }

  get workspaceRoot() {
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
      this.clear();
    });
  }

  async resolveChildren(parent?: Directory) {
    if (!parent) {
      // 加载根目录
      await this.workspaceService.roots;
      if (this.workspaceService.workspace) {
        const children = await this.fileTreeAPI.resolveChildren(this as ITree, this.workspaceService.workspace);
        this.cacheNodes(children as (File | Directory)[]);
        return children;
      }
    } else {
      // 加载子目录
      if (parent.uri) {
        const children =  await this.fileTreeAPI.resolveChildren(this as ITree, parent.uri.toString(), parent);
        this.cacheNodes(children as (File | Directory)[]);
        return children;
      }
    }
    return [];
  }

  private cacheNodes(nodes: (File | Directory)[]) {
    // 切换工作区的时候需清理
    nodes.map((node) => {
      this.cacheNodesMap.set(node.uri.toString(), node);
    });
  }

  getNodeByUriString(path: string) {
    return this.cacheNodesMap.get(path);
  }

  clear() {
    for (const watcher of Object.keys(this.fileServiceWatchers)) {
      this.fileServiceWatchers[watcher].dispose();
    }
    this.cacheNodesMap.clear();
  }

  dispose() {
    super.dispose();
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
