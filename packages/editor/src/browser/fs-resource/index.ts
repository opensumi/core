import { Domain } from '@ide-framework/ide-core-browser';
import { BrowserEditorContribution } from '../types';
import { Autowired } from '@ide-framework/common-di';
import { FileSystemResourceProvider } from './fs-resource';
import { ResourceService } from '../../common';
import { IEditorDocumentModelContentRegistry } from '../doc-model/types';
import { BaseFileSystemEditorDocumentProvider } from './fs-editor-doc';

@Domain(BrowserEditorContribution)
export class FileSystemResourceContribution implements BrowserEditorContribution {

  @Autowired(FileSystemResourceProvider)
  fsResourceProvider: FileSystemResourceProvider;

  @Autowired(BaseFileSystemEditorDocumentProvider)
  fsDocProvider: BaseFileSystemEditorDocumentProvider;

  registerResource(registry: ResourceService) {
    registry.registerResourceProvider(this.fsResourceProvider);
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    registry.registerEditorDocumentModelContentProvider(this.fsDocProvider);
  }
}
