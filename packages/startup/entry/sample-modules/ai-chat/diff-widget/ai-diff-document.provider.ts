import { Injectable, Autowired } from '@opensumi/di';
import { URI, WithEventBus, MaybePromise, LabelService, Emitter, Event } from '@opensumi/ide-core-browser';
import { IResource, IResourceProvider } from '@opensumi/ide-editor';
import { IEditorDocumentModelContentProvider } from '@opensumi/ide-editor/lib/browser/index';
import { MergeEditorService } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/merge-editor.service';

@Injectable()
export class AiDiffDocumentProvider implements IEditorDocumentModelContentProvider {
  private _onDidChangeContent = new Emitter<URI>();

  onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  provideEditorDocumentModelContent(uri: URI, encoding?: string): MaybePromise<string> {
    return '';
  }

  isReadonly(uri: URI): MaybePromise<boolean> {
    return false;
  }

  handlesScheme(scheme: string) {
    return scheme === 'AI';
  }
}