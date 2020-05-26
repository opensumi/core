import { IEditorDocumentModelContentProvider, IResourceProvider } from '@ali/ide-editor/lib/browser';
import { Emitter, Event, URI } from '@ali/ide-core-common';

export class SampleDocContentProvider implements IEditorDocumentModelContentProvider {
  handlesScheme(scheme: string) {
    return scheme === 'file';
  }

  provideEditorDocumentModelContent(uri: URI, encoding?: string | undefined) {
    return uri.toString() + ' mock content provider';
  }

  isReadonly(uri: URI) {
    // todo
    return true;
  }

  private _onDidChangeTestContent = new Emitter<URI>();
  public onDidChangeContent: Event<URI> = this._onDidChangeTestContent.event;
}

// TODO: use `FileSystemResourceProvider` instead when ready
export class SampleResourceProvider implements IResourceProvider {
  readonly scheme = 'file';
  provideResource(uri: URI) {
    return {
      name: uri.toString(),
      icon: '', // 依赖 labelService
      uri,
      metadata: null,
    };
  }
}
