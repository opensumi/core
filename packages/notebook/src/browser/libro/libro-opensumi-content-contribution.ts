import { ContentContribution } from '@difizen/libro-core';
import { IContentsModel, INotebookContent, LibroJupyterModel, NotebookOption } from '@difizen/libro-jupyter/noeditor';
import { getOrigin, inject, singleton } from '@difizen/mana-app';

import { Injector } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IMessageService } from '@opensumi/ide-overlay';

import { ContentLoaderType, OpensumiInjector } from '../mana';

@singleton({ contrib: ContentContribution })
export class LibroOpensumiContentContribution implements ContentContribution {
  @inject(OpensumiInjector) injector: Injector;

  canHandle = (options) => (options.loadType === ContentLoaderType ? 100 : 1);
  async loadContent(options: NotebookOption, model: LibroJupyterModel): Promise<INotebookContent> {
    const fileServiceClient: IFileServiceClient = this.injector.get(IFileServiceClient);
    const messageService = this.injector.get(IMessageService);
    let notebookContent: INotebookContent;
    try {
      const { content } = await getOrigin(fileServiceClient).readFile(options.resource.toString());
      const stat = await getOrigin(fileServiceClient).getFileStat(options.resource.toString());
      if (content.byteLength === 0) {
        notebookContent = {
          cells: [],
          metadata: {},
          nbformat: 4,
          nbformat_minor: 5,
        };
      } else {
        notebookContent = JSON.parse(content.toString());
      }
      const uri = new URI(options.resource.toString());
      const currentFileContents: IContentsModel = {
        name: uri.path.base,
        // TODO: should be relative path to notebook root, notebook root may not be same as ide root, and jupyter provide no api to get root dir
        path: uri.path.toString(),
        last_modified: stat?.lastModification.toString() || new Date().toJSON(),
        created: stat?.createTime?.toString() || new Date().toJSON(),
        content: notebookContent,
        size: stat?.size,
        writable: true,
        type: 'notebook',
      };
      model.currentFileContents = currentFileContents;
      model.filePath = currentFileContents.path;
      model.id = currentFileContents.path; //
      model.lastModified = model.currentFileContents.last_modified;
      if (model.executable) {
        model.startKernelConnection();
      }
    } catch (e) {
      messageService.error(`Notebook file ${options.resource.toString()} read error: ${e}`);
      notebookContent = {
        cells: [],
        metadata: {},
        nbformat: 4,
        nbformat_minor: 5,
      };
    }
    return notebookContent;
  }
}
