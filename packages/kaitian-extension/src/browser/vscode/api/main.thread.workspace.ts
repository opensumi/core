import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadWorkspace, IExtHostStorage, WorkspaceEditDto, ResourceTextEditDto, ResourceFileEditDto } from '../../../common/vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';
import { URI, ILogger } from '@ali/ide-core-browser';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { IWorkspaceEditService, IWorkspaceEdit, IResourceTextEdit, IResourceFileEdit } from '@ali/ide-workspace-edit';
import { WorkbenchEditorService } from '@ali/ide-editor';

@Injectable()
export class MainThreadWorkspace implements IMainThreadWorkspace {

  private readonly proxy: any;
  private roots: FileStat[];

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @Autowired(IExtensionStorageService)
  extensionStorageService: IExtensionStorageService;

  @Autowired(IWorkspaceEditService)
  workspaceEditService: IWorkspaceEditService;

  storageProxy: IExtHostStorage;

  @Autowired(ILogger)
  logger: ILogger;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWorkspace);

    this.processWorkspaceFoldersChanged(this.workspaceService.tryGetRoots());
    this.workspaceService.onWorkspaceChanged((roots) => {
      this.processWorkspaceFoldersChanged(roots);
    });

    this.storageProxy = rpcProtocol.getProxy<IExtHostStorage>(ExtHostAPIIdentifier.ExtHostStorage);
  }

  private isAnyRootChanged(roots: FileStat[]): boolean {
    if (!this.roots || this.roots.length !== roots.length) {
        return true;
    }

    return this.roots.some((root, index) => root.uri !== roots[index].uri);
  }

  async processWorkspaceFoldersChanged(roots: FileStat[]): Promise<void> {
    if (this.isAnyRootChanged(roots) === false) {
        return;
    }
    this.roots = roots;
    this.proxy.$onWorkspaceFoldersChanged({ roots });

    // workspace变化，更新及初始化storage
    const storageWorkspacesData = await this.extensionStorageService.getAll(false);
    this.storageProxy.$updateWorkspaceStorageData(storageWorkspacesData);
  }

  dispose() {

  }

  async $updateWorkspaceFolders(start: number, deleteCount?: number, ...rootsToAdd: string[]): Promise<void> {
    await this.workspaceService.spliceRoots(start, deleteCount, ...rootsToAdd.map((root) => new URI(root)));
  }

  async $tryApplyWorkspaceEdit(dto: WorkspaceEditDto): Promise<boolean> {
    const workspaceEdit = reviveWorkspaceEditDto(dto);
    try {
      await this.workspaceEditService.apply(workspaceEdit);
      return true;
    } catch (e) {
      return false;
    }
  }

  async $saveAll(): Promise<boolean> {
    try {
      await this.editorService.saveAll();
      return true;
    } catch (e) {
      this.logger.error(e);
      return false;
    }
  }

}

export function reviveWorkspaceEditDto(data: WorkspaceEditDto | undefined): IWorkspaceEdit {
  if (data && data.edits) {
    for (const edit of data.edits) {
      if (typeof ( edit as ResourceTextEditDto).resource === 'object') {
        ( edit as IResourceTextEdit).resource = URI.from(( edit as ResourceTextEditDto).resource);
        ( edit as IResourceTextEdit).options = { openDirtyInEditor: true };
      } else {
        ( edit as IResourceFileEdit).newUri = ( edit as ResourceFileEditDto).newUri ? URI.from(( edit as ResourceFileEditDto).newUri!) : undefined;
        ( edit as IResourceFileEdit).oldUri = ( edit as ResourceFileEditDto).oldUri ? URI.from(( edit as ResourceFileEditDto).oldUri!) : undefined;
        ( edit as IResourceFileEdit).options.showInEditor = true;
      }
    }
  }
  return  data as IWorkspaceEdit;
}
