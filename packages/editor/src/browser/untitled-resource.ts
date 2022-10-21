import { Injectable, Autowired } from '@opensumi/di';
import {
  URI,
  Emitter,
  Event,
  Schemes,
  WithEventBus,
  IEditorDocumentChange,
  IEditorDocumentModelSaveResult,
  AppConfig,
  CommandService,
  OperatingSystem,
  IApplicationService,
  PreferenceService,
  getLanguageIdFromMonaco,
  localize,
  formatLocalize,
  MessageType,
  path,
  isWindows,
  SaveTaskResponseState,
} from '@opensumi/ide-core-browser';
import { EOL } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IDialogService } from '@opensumi/ide-overlay';

import { AskSaveResult, IResource, IResourceProvider, WorkbenchEditorService } from '../common';

import { IEditorDocumentModelService, IEditorDocumentModelContentProvider } from './doc-model/types';

@Injectable()
export class UntitledDocumentIdCounter {
  private _id = 1;

  get id() {
    return this._id++;
  }
}

@Injectable()
export class UntitledSchemeDocumentProvider implements IEditorDocumentModelContentProvider {
  @Autowired(IEditorDocumentModelService)
  editorDocumentModelService: IEditorDocumentModelService;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  private _onDidChangeContent: Emitter<URI> = new Emitter();

  public onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  handlesScheme(scheme: string): boolean {
    return scheme === Schemes.untitled;
  }

  async provideEncoding(uri: URI) {
    const encoding = this.preferenceService.get<string>(
      'files.encoding',
      undefined,
      uri.toString(),
      getLanguageIdFromMonaco(uri)!,
    );
    return encoding || 'utf8';
  }

  async provideEOL(uri: URI) {
    const backendOS = await this.applicationService.getBackendOS();
    const eol = this.preferenceService.get<EOL | 'auto'>(
      'files.eol',
      'auto',
      uri.toString(),
      getLanguageIdFromMonaco(uri)!,
    )!;

    if (eol !== 'auto') {
      return eol;
    }
    return backendOS === OperatingSystem.Windows ? EOL.CRLF : EOL.LF;
  }

  async provideEditorDocumentModelContent(uri: URI, encoding?: string | undefined): Promise<string> {
    return '';
  }

  isReadonly(uri: URI): boolean {
    return false;
  }

  isAlwaysDirty(uri: URI): boolean {
    // untitled 文件允许新建后就可以保存
    return true;
  }

  disposeEvenDirty(uri: URI): boolean {
    // untitled 即便是 dirty 状态下，在关闭后也要被 dispose
    return true;
  }

  closeAutoSave(uri: URI): boolean {
    return true;
  }

  async saveDocumentModel(
    uri: URI,
    content: string,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding: string,
    ignoreDiff = false,
  ): Promise<IEditorDocumentModelSaveResult> {
    const { name } = uri.getParsedQuery();
    const defaultPath = uri.path.toString() !== '/' ? path.dirname(uri.path.toString()) : this.appConfig.workspaceDir;
    const saveUri = await this.commandService.tryExecuteCommand<URI>('file.save', {
      showNameInput: true,
      defaultFileName: name || uri.displayName,
      defaultUri: URI.file(isWindows ? defaultPath.replaceAll('\\', '/') : defaultPath),
    });
    if (saveUri) {
      await this.editorDocumentModelService.saveEditorDocumentModel(
        saveUri,
        content,
        baseContent,
        changes,
        encoding,
        ignoreDiff,
      );
      // TODO: 不依赖 workspaceEditor，先关闭再打开，等 fileSystemProvider 迁移到前端再做改造
      await this.workbenchEditorService.open(saveUri, {
        preview: false,
        focus: true,
        replace: true,
        forceClose: true,
      });
    }
    return {
      state: SaveTaskResponseState.SUCCESS,
    };
  }
  onDidDisposeModel() {}
}

@Injectable()
export class UntitledSchemeResourceProvider extends WithEventBus implements IResourceProvider {
  readonly scheme: string = Schemes.untitled;

  @Autowired(IDialogService)
  protected dialogService: IDialogService;

  @Autowired(IEditorDocumentModelService)
  protected documentModelService: IEditorDocumentModelService;

  provideResource(uri: URI) {
    const { name } = uri.getParsedQuery();
    return {
      name: name || uri.displayName,
      uri,
      icon: '',
      metadata: null,
    };
  }

  async shouldCloseResourceWithoutConfirm(resource: IResource) {
    const documentModelRef = this.documentModelService.getModelReference(resource.uri, 'close-resource-check');
    if (documentModelRef && documentModelRef.instance.dirty) {
      return true;
    }
    return false;
  }

  async close(resource: IResource, saveAction?: AskSaveResult) {
    const documentModelRef = this.documentModelService.getModelReference(resource.uri, 'close-resource-check');
    if (!documentModelRef) {
      return false;
    }
    if (saveAction === AskSaveResult.SAVE) {
      const res = await documentModelRef.instance.save();
      documentModelRef.dispose();
      return res;
    } else if (saveAction === AskSaveResult.REVERT) {
      await documentModelRef.instance.revert();
      documentModelRef.dispose();
      return true;
    } else if (!saveAction || saveAction === AskSaveResult.CANCEL) {
      documentModelRef.dispose();
      return false;
    } else {
      return true;
    }
  }

  async shouldCloseResource(resource: IResource) {
    const documentModelRef = this.documentModelService.getModelReference(resource.uri, 'close-resource-check');
    if (!documentModelRef || !documentModelRef.instance.dirty) {
      if (documentModelRef) {
        documentModelRef.dispose();
      }
      return true;
    }
    // 询问用户是否保存
    const buttons = {
      [localize('file.prompt.dontSave', '不保存')]: AskSaveResult.REVERT,
      [localize('file.prompt.save', '保存')]: AskSaveResult.SAVE,
      [localize('file.prompt.cancel', '取消')]: AskSaveResult.CANCEL,
    };
    const selection = await this.dialogService.open(
      formatLocalize('saveChangesMessage', resource.name),
      MessageType.Info,
      Object.keys(buttons),
    );
    return await this.close(resource, buttons[selection!]);
  }
}
