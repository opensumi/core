import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { URI, ILogger, WithEventBus, OnEvent, CancellationToken } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IExtensionStorageService } from '@opensumi/ide-extension-storage';
import { FileSearchServicePath, IFileSearchService } from '@opensumi/ide-file-search/lib/common';
import { FileStat } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IWorkspaceEditService, WorkspaceEditDidRenameFileEvent } from '@opensumi/ide-workspace-edit';

import {
  ExtHostAPIIdentifier,
  IMainThreadWorkspace,
  IExtHostStorage,
  IExtHostWorkspace,
  reviveWorkspaceEditDto,
} from '../../../common/vscode';
import type * as model from '../../../common/vscode/model.api';

@Injectable({ multiple: true })
export class MainThreadWorkspace extends WithEventBus implements IMainThreadWorkspace {
  private readonly proxy: IExtHostWorkspace;
  private roots: FileStat[];

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @Autowired(FileSearchServicePath)
  private readonly fileSearchService;

  @Autowired(IExtensionStorageService)
  extensionStorageService: IExtensionStorageService;

  @Autowired(IWorkspaceEditService)
  workspaceEditService: IWorkspaceEditService;

  storageProxy: IExtHostStorage;

  @Autowired(ILogger)
  logger: ILogger;

  private workspaceChangeEvent;

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWorkspace);

    this.processWorkspaceFoldersChanged(this.workspaceService.tryGetRoots());

    this.addDispose(
      (this.workspaceChangeEvent = this.workspaceService.onWorkspaceChanged((roots) => {
        this.processWorkspaceFoldersChanged(roots);
      })),
    );

    this.storageProxy = rpcProtocol.getProxy<IExtHostStorage>(ExtHostAPIIdentifier.ExtHostStorage);
  }

  async $startFileSearch(
    includePattern: string,
    options: { cwd?: string; absolute: boolean },
    excludePatternOrDisregardExcludes: string | false | undefined,
    maxResult: number | undefined,
    token: CancellationToken,
  ): Promise<string[]> {
    const fileSearchOptions: IFileSearchService.Options = {
      rootUris: options.cwd ? [options.cwd] : this.workspaceService.tryGetRoots().map((root) => root.uri),
      excludePatterns: excludePatternOrDisregardExcludes ? [excludePatternOrDisregardExcludes] : undefined,
      limit: maxResult,
      includePatterns: [includePattern],
    };
    const result = await this.fileSearchService.find('', fileSearchOptions);

    return result;
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
    this.workspaceChangeEvent.dispose();
  }

  async $updateWorkspaceFolders(
    start: number,
    deleteCount?: number,
    workspaceToName?: { [key: string]: string },
    ...rootsToAdd: string[]
  ): Promise<void> {
    await this.workspaceService.spliceRoots(
      start,
      deleteCount,
      workspaceToName,
      ...rootsToAdd.map((root) => new URI(root)),
    );
  }

  async $tryApplyWorkspaceEdit(dto: model.WorkspaceEditDto): Promise<boolean> {
    const workspaceEdit = reviveWorkspaceEditDto(dto);
    try {
      await this.workspaceEditService.apply(workspaceEdit);
      return true;
    } catch (e) {
      this.logger.error(e);
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

  @OnEvent(WorkspaceEditDidRenameFileEvent)
  onRenameFile(e: WorkspaceEditDidRenameFileEvent) {
    this.proxy.$didRenameFile(e.payload.oldUri.codeUri, e.payload.newUri.codeUri);
  }
}
