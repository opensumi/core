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

  @Autowired(IMarkerService)
  protected readonly markerService: IMarkerService;

  private isAutoCollecting = false;

  private contextFiles: Map<string, FileContext> = new Map();

  private onDidContextFilesChangeEmitter = new Emitter<FileContext[]>();
  onDidContextFilesChangeEvent = this.onDidContextFilesChangeEmitter.event;

  addFileToContext(uri: URI, selection?: [number, number], isManual = true): void {
    this.contextFiles.set(uri.toString(), {
      uri,
      selection,
      isManual,
    });
    this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
  }

  cleanFileContext() {
    this.contextFiles.clear();
    this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
  }

  private getAllContextFiles() {
    return Array.from(this.contextFiles.values());
  }

  removeFileFromContext(uri: URI): void {
    this.contextFiles.delete(uri.toString());
    this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
  }

  startAutoCollection(): void {
    if (this.isAutoCollecting) {
      return;
    }
    this.isAutoCollecting = true;

    this.startAutoCollectionInternal();
  }

  private startAutoCollectionInternal(): void {
    // 文件打开
    this.disposables.push(
      this.eventBus.on(EditorDocumentModelCreationEvent, (event) => {
        if (event.payload.uri.scheme !== 'file') {
          return;
        }
        // TODO: 是否自动添加文件到上下文？
        // this.addFileToContext(event.payload.uri);
      }),
    );

    // 删除
    this.disposables.push(
      this.eventBus.on(EditorDocumentModelRemovalEvent, (event) => {
        if (event.payload.scheme !== 'file') {
          return;
        }
      }),
    );

    // 保存
    this.disposables.push(
      this.eventBus.on(EditorDocumentModelSavedEvent, (event) => {
        if (event.payload.scheme !== 'file') {
          return;
        }
      }),
    );

    // 光标选中
    this.disposables.push(
      this.eventBus.on(EditorSelectionChangeEvent, (event) => {
        if (event.payload.selections.length > 0) {
          const selection = [
            event.payload.selections[0].selectionStartLineNumber,
            event.payload.selections[0].positionLineNumber,
          ].sort() as [number, number];
          if (selection[0] === selection[1]) {
            // TODO: 是否自动添加文件到上下文？
            // this.addFileToContext(event.payload.editorUri, undefined);
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
      .map((file) => URI.file(this.appConfig.workspaceDir).relative(file.uri)!.toString())
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
