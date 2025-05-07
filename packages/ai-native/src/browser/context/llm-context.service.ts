import { DataContent } from 'ai';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser/lib/react-providers/config-provider';
import { WithEventBus } from '@opensumi/ide-core-common/lib/event-bus/event-decorator';
import { MarkerSeverity } from '@opensumi/ide-core-common/lib/types/markers/markers';
import { Emitter, URI } from '@opensumi/ide-core-common/lib/utils';
import {
  EditorDocumentModelCreationEvent,
  EditorDocumentModelRemovalEvent,
  EditorDocumentModelSavedEvent,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser/doc-model/types';
import { EditorSelectionChangeEvent } from '@opensumi/ide-editor/lib/browser/types';
import { FileType, IFileServiceClient } from '@opensumi/ide-file-service';
import { IMarkerService } from '@opensumi/ide-markers/lib/common/types';
import { Range } from '@opensumi/ide-monaco';

import { AttachFileContext, FileContext, LLMContextService, SerializedContext } from '../../common/llm-context';

@Injectable()
export class LLMContextServiceImpl extends WithEventBus implements LLMContextService {
  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(IEditorDocumentModelService)
  protected readonly docModelManager: IEditorDocumentModelService;

  @Autowired(IMarkerService)
  protected readonly markerService: IMarkerService;

  @Autowired(IFileServiceClient)
  protected readonly fileService: IFileServiceClient;

  private isAutoCollecting = false;

  private contextVersion = 0;

  private readonly maxAttachFilesLimit = 10;
  private readonly maxAttachFoldersLimit = 10;
  private readonly maxViewFilesLimit = 20;
  private attachedFiles: FileContext[] = [];
  private attachedFolders: FileContext[] = [];
  private readonly recentlyViewFiles: FileContext[] = [];
  private readonly onDidContextFilesChangeEmitter = new Emitter<{
    viewed: FileContext[];
    attached: FileContext[];
    attachedFolders: FileContext[];
    version: number;
  }>();
  private hasUserManualReference = false;
  onDidContextFilesChangeEvent = this.onDidContextFilesChangeEmitter.event;

  private addFileToList(file: FileContext, list: FileContext[], maxLimit: number) {
    const existingIndex = list.findIndex(
      (f) =>
        f.uri.toString() === file.uri.toString() &&
        f.selection?.[0] === file.selection?.[0] &&
        f.selection?.[1] === file.selection?.[1],
    );
    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
    }

    list.push(file);
    if (list.length > maxLimit) {
      list.shift();
    }
  }

  private addFolderToList(folder: FileContext, list: FileContext[], maxLimit: number) {
    const existingIndex = list.findIndex((f) => f.uri.toString() === folder.uri.toString());
    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
    }

    list.push(folder);
    if (list.length > maxLimit) {
      list.shift();
    }
  }

  addFileToContext(uri: URI, selection?: [number, number], isManual = false): void {
    if (!uri) {
      return;
    }

    if (isManual) {
      this.hasUserManualReference = true;
    }

    const file = { uri, selection };
    const targetList = isManual ? this.attachedFiles : this.recentlyViewFiles;
    const maxLimit = isManual ? this.maxAttachFilesLimit : this.maxViewFilesLimit;

    if (isManual) {
      this.docModelManager.createModelReference(uri);
    }

    this.addFileToList(file, targetList, maxLimit);
    this.notifyContextChange();
  }

  addFolderToContext(uri: URI): void {
    if (!uri) {
      return;
    }

    const file = { uri };

    this.addFolderToList(file, this.attachedFolders, this.maxAttachFoldersLimit);
    this.notifyContextChange();
  }

  private notifyContextChange(): void {
    this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
  }

  cleanFileContext() {
    this.attachedFiles = [];
    this.attachedFolders = [];
    this.hasUserManualReference = false;
    this.notifyContextChange();
  }

  private getAllContextFiles() {
    return {
      viewed: this.recentlyViewFiles,
      attached: this.attachedFiles,
      attachedFolders: this.attachedFolders,
      version: this.contextVersion++,
    };
  }

  removeFileFromContext(uri: URI, isManual = false): void {
    const targetList = isManual ? this.attachedFiles : this.recentlyViewFiles;
    const index = targetList.findIndex((file) => file.uri.toString() === uri.toString());
    if (index > -1) {
      targetList.splice(index, 1);
    }
    this.notifyContextChange();
  }

  startAutoCollection(): void {
    if (this.isAutoCollecting) {
      return;
    }
    this.isAutoCollecting = true;

    this.startAutoCollectionInternal();
  }

  private startAutoCollectionInternal(): void {
    this.disposables.push(
      this.eventBus.on(EditorDocumentModelCreationEvent, (event) => {
        if (event.payload.uri.scheme !== 'file') {
          return;
        }
        this.addFileToContext(event.payload.uri, undefined, false);
      }),
    );

    this.disposables.push(
      this.eventBus.on(EditorDocumentModelRemovalEvent, (event) => {
        if (event.payload.scheme !== 'file') {
          return;
        }

        this.removeFileFromContext(event.payload, false);
      }),
    );

    this.disposables.push(
      this.eventBus.on(EditorDocumentModelSavedEvent, (event) => {
        if (event.payload.scheme !== 'file') {
          return;
        }
        // TODO: 保存文件的逻辑
      }),
    );

    this.disposables.push(
      this.eventBus.on(EditorSelectionChangeEvent, (event) => {
        if (event.payload.selections.length > 0) {
          const selection = [
            event.payload.selections[0].selectionStartLineNumber,
            event.payload.selections[0].positionLineNumber,
          ].sort() as [number, number];

          if (!this.hasUserManualReference) {
            // 当没有用户手动引用时，才自动收集
            if (selection[0] === selection[1]) {
              this.addFileToContext(event.payload.editorUri, undefined, false);
            } else {
              this.addFileToContext(
                event.payload.editorUri,
                selection.sort((a, b) => a - b),
                false,
              );
            }
          }
        }
      }),
    );
  }

  stopAutoCollection(): void {
    this.dispose();
  }

  async serialize(): Promise<SerializedContext> {
    const files = this.getAllContextFiles();
    const workspaceRoot = URI.file(this.appConfig.workspaceDir);

    return {
      recentlyViewFiles: this.serializeRecentlyViewFiles(files.viewed, workspaceRoot),
      attachedFiles: this.serializeAttachedFiles(files.attached, workspaceRoot),
      attachedFolders: await this.serializeAttachedFolders(files.attachedFolders, workspaceRoot),
    };
  }

  private async serializeAttachedFolders(folders: FileContext[], workspaceRoot: URI): Promise<string[]> {
    // 去重
    const folderPath = Array.from(new Set(folders.map((folder) => folder.uri.toString())));
    return Promise.all(
      folderPath.map(async (folder) => {
        const folderUri = new URI(folder);
        const root = workspaceRoot.relative(folderUri)?.toString() || '/';
        return `\`\`\`\n${root}\n${(await this.getPartiaFolderStructure(folderUri.codeUri.fsPath))
          .map((line) => `- ${line}`)
          .join('\n')}\n\`\`\`\n`;
      }),
    );
  }

  private async getPartiaFolderStructure(folder: string, level = 2): Promise<string[]> {
    const result: string[] = [];
    try {
      const stat = await this.fileService.getFileStat(folder);

      for (const child of stat?.children || []) {
        const relativePath = new URI(folder).relative(new URI(child.uri))!.toString();

        if (child.isSymbolicLink) {
          // 处理软链接
          const target = await this.fileService.getFileStat(child.realUri || child.uri);
          if (target) {
            result.push(`${relativePath} -> ${target} (symbolic link)`);
          } else {
            result.push(`${relativePath} (broken symbolic link)`);
          }
          continue;
        }

        if (child.type === FileType.Directory) {
          result.push(`${relativePath}/`);
          if (level > 1) {
            const subDirStructure = await this.getPartiaFolderStructure(child.uri, level - 1);
            result.push(...subDirStructure.map((subEntry) => `${relativePath}/${subEntry}`));
          }
        } else if (child.type === FileType.File) {
          result.push(relativePath);
        }
      }
    } catch {
      return result;
    }

    return result;
  }

  private serializeRecentlyViewFiles(files: FileContext[], workspaceRoot: URI): string[] {
    return files
      .map((file) => workspaceRoot.relative(file.uri)?.toString() || file.uri.parent.toString())
      .filter(Boolean);
  }

  private serializeAttachedFiles(files: FileContext[], workspaceRoot: URI): AttachFileContext[] {
    return files
      .map((file) => this.serializeAttachedFile(file, workspaceRoot))
      .filter(Boolean) as unknown as AttachFileContext[];
  }

  private serializeAttachedFile(file: FileContext, workspaceRoot: URI) {
    try {
      const ref = this.docModelManager.getModelReference(file.uri);
      if (!ref) {
        return null;
      }

      return {
        content: ref.instance.getText(
          file.selection && new Range(file.selection[0], Infinity, file.selection[1], Infinity),
        ),
        lineErrors: this.getFileErrors(file.uri),
        path: workspaceRoot.relative(file.uri)!.toString(),
        language: ref.instance.languageId!,
      };
    } catch (e) {
      return null;
    }
  }

  private getFileErrors(uri: URI): string[] {
    return this.markerService
      .getManager()
      .getMarkers({
        resource: uri.toString(),
        severities: MarkerSeverity.Error,
      })
      .map((marker) => marker.message);
  }
}
