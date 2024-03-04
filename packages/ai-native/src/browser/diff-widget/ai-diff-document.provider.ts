import { Injectable } from '@opensumi/di';
import { Emitter, Event, MaybePromise, URI } from '@opensumi/ide-core-browser';
import { Schemes } from '@opensumi/ide-core-common';
import { IEditorDocumentModelContentProvider } from '@opensumi/ide-editor/lib/browser/index';

@Injectable()
export class AIDiffDocumentProvider implements IEditorDocumentModelContentProvider {
  private _onDidChangeContent = new Emitter<URI>();

  onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  provideEditorDocumentModelContent(uri: URI, encoding?: string): MaybePromise<string> {
    return '';
  }

  isReadonly(uri: URI): MaybePromise<boolean> {
    return false;
  }

  handlesScheme(scheme: string) {
    return scheme === Schemes.ai;
  }
}
