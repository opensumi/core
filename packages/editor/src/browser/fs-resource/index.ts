import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';


import { ResourceService } from '../../common';
import { IEditorDocumentModelContentRegistry } from '../doc-model/types';
import { BrowserEditorContribution } from '../types';

import { BaseFileSystemEditorDocumentProvider } from './fs-editor-doc';
import { FileSystemResourceProvider } from './fs-resource';

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
