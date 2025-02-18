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

import { FileContext, LLMContextService, SerializedContext } from '../../common/llm-context';

@Injectable()
export class LLMContextServiceImpl extends WithEventBus implements LLMContextService {
  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(IEditorDocumentModelService)
  protected readonly docModelManager: IEditorDocumentModelService;
  z
  @Autowired(IMarkerService)
  protected readonly markerService: IMarkerService;

  private isAutoCollecting = false;

  private contextFiles: FileContext[] = [];

  private maxFiles: number = 10; // 上下文的最大长度限制

  private onDidContextFilesChangeEmitter = new Emitter<FileContext[]>();
  onDidContextFilesChangeEvent = this.onDidContextFilesChangeEmitter.event;

  addFileToContext(uri: URI, selection?: [number, number], isManual = true): void {
    // 如果已经存在，则移除旧的条目
    this.removeFileFromContext(uri);

    // 添加新的文件上下文
    this.contextFiles.push({ uri, selection, isManual });

    // 如果超过了最大数量，则移除最旧的文件上下文
    if (this.contextFiles.length > this.maxFiles) {
      this.contextFiles.shift(); // 移除最旧的条目
    }

    this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
  }

  cleanFileContext() {
    this.contextFiles = [];
    this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
  }

  private getAllContextFiles() {
    return [...this.contextFiles];
  }

  removeFileFromContext(uri: URI): void {
    const index = this.contextFiles.findIndex((file) => file.uri.toString() === uri.toString());
    if (index > -1) {
      this.contextFiles.splice(index, 1); // 从数组中移除指定的文件上下文
      this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
    }
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
        this.addFileToContext(event.payload.uri);
      }),
    );

    this.disposables.push(
      this.eventBus.on(EditorDocumentModelRemovalEvent, (event) => {
        if (event.payload.scheme !== 'file') {
          return;
        }
      }),
    );

    this.disposables.push(
      this.eventBus.on(EditorDocumentModelSavedEvent, (event) => {
        if (event.payload.scheme !== 'file') {
          return;
        }
        // 这里可以添加保存文件的逻辑
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
            this.addFileToContext(event.payload.editorUri, undefined);
          } else {
            this.addFileToContext(
              event.payload.editorUri,
              selection.sort((a, b) => a - b),
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
    const recentlyViewFiles = files
      .filter((v) => !v.selection)
      .map((file) => {
        const relativePath = URI.file(this.appConfig.workspaceDir).relative(file.uri);
        if (relativePath) {
          return relativePath.toString();
        }
        return file.uri.parent.toString;
      })
      .filter(Boolean);

    const attachedFiles = files
      .filter((v) => v.selection)
      .map((file) => {
        const ref = this.docModelManager.getModelReference(file.uri);
        const content = ref!.instance.getText();
        const lineErrors = this.markerService
          .getManager()
          .getMarkers({
            resource: file.uri.toString(),
            severities: MarkerSeverity.Error,
          })
          .map((marker) => marker.message);

        return {
          content,
          lineErrors,
          path: URI.file(this.appConfig.workspaceDir).relative(file.uri)!.toString(),
          language: ref?.instance.languageId!,
        };
      })
      .filter(Boolean);

    return {
      recentlyViewFiles,
      attachedFiles,
    };
  }
}
