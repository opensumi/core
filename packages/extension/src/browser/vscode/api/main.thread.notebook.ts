import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { UriComponents, WithEventBus } from '@opensumi/ide-core-common';
import { INotebookService, NotebookDataDto } from '@opensumi/ide-editor';

import {
  ExtHostAPIIdentifier,
  ExtensionDocumentDataManager,
  ExtensionNotebookDocumentManager,
  IMainThreadNotebookDocumentsShape,
} from '../../../common/vscode';

@Injectable({ multiple: true })
export class MainThreadExtensionNotebook extends WithEventBus implements IMainThreadNotebookDocumentsShape {
  private readonly proxy: ExtensionNotebookDocumentManager;
  private readonly docProxy: ExtensionDocumentDataManager;

  @Autowired(INotebookService)
  protected readonly notebookService: INotebookService;

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostNotebook);
    this.docProxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostDocuments);
    this.listen();
  }

  protected listen() {
    this.addDispose(
      this.notebookService.onDidOpenNotebookDocument((notebook) => {
        this.proxy.$acceptDocumentAndEditorsDelta({ addedDocuments: [notebook] });
      }),
    );
    this.addDispose(
      this.notebookService.onDidCloseNotebookDocument((uri) => {
        this.proxy.$acceptDocumentAndEditorsDelta({ removedDocuments: [uri] });
      }),
    );
    this.addDispose(
      this.notebookService.onDidChangeNotebookDocument((e) => {
        this.proxy.$acceptModelChanged(e.uri, e.event, e.isDirty, e.metadata);
      }),
    );
    this.addDispose(
      this.notebookService.onDidSaveNotebookDocument((doc) => {
        this.proxy.$acceptModelSaved(doc);
      }),
    );
  }

  async $tryCreateNotebook(options: { viewType: string; content?: NotebookDataDto }): Promise<UriComponents> {
    const notebook = await this.notebookService.createNotebook(options.content);
    return notebook.uri;
  }

  async $tryOpenNotebook(uriComponents: UriComponents): Promise<UriComponents> {
    const notebook = await this.notebookService.openNotebook(uriComponents);
    return notebook.uri;
  }

  async $trySaveNotebook(uri: UriComponents): Promise<boolean> {
    return await this.notebookService.saveNotebook(uri);
  }
}
