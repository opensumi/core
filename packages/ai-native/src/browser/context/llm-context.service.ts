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
import { IMarkerService } from '@opensumi/ide-markers/lib/common/types';

import { AttachFileContext, FileContext, LLMContextService, SerializedContext } from '../../common/llm-context';

@Injectable()
export class LLMContextServiceImpl extends WithEventBus implements LLMContextService {
  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(IEditorDocumentModelService)
  protected readonly docModelManager: IEditorDocumentModelService;

  @Autowired(IMarkerService)
  protected readonly markerService: IMarkerService;

  private isAutoCollecting = false;

  private contextVersion = 0;

  private readonly maxAttachFilesLimit = 10;
  private readonly maxViewFilesLimit = 20;
  private readonly attachedFiles: FileContext[] = [];
  private readonly recentlyViewFiles: FileContext[] = [];
  private readonly onDidContextFilesChangeEmitter = new Emitter<{ viewed: FileContext[]; attached: FileContext[]; version: number }>();
  onDidContextFilesChangeEvent = this.onDidContextFilesChangeEmitter.event;

  private addFileToList(file: FileContext, list: FileContext[], maxLimit: number) {
    const existingIndex = list.findIndex((f) => f.uri.toString() === file.uri.toString());
    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
    }

    list.push(file);
    if (list.length > maxLimit) {
      list.shift();
    }
  }

  addFileToContext(uri: URI, selection?: [number, number], isManual = false): void {
    if (!uri) {
      return;
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

  private notifyContextChange(): void {
    this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
  }

  cleanFileContext() {
    this.attachedFiles.length = 0;
    this.notifyContextChange();
  }

  private getAllContextFiles() {
    return {
      viewed: this.recentlyViewFiles,
      attached: this.attachedFiles,
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
      }),
    );
  }

  stopAutoCollection(): void {
    this.dispose();
  }

  serialize(): SerializedContext {
    const files = this.getAllContextFiles();
    const workspaceRoot = URI.file(this.appConfig.workspaceDir);

    return {
      recentlyViewFiles: this.serializeRecentlyViewFiles(files.viewed, workspaceRoot),
      attachedFiles: this.serializeAttachedFiles(files.attached, workspaceRoot),
    };
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
        content: ref.instance.getText(),
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
