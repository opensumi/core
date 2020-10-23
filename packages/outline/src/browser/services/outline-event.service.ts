import { Emitter, WithEventBus, OnEvent, URI, Event } from '@ali/ide-core-browser';
import { IResource, IEditorGroup } from '@ali/ide-editor';
import { Injectable } from '@ali/common-di';
import { EditorActiveResourceStateChangedEvent, EditorSelectionChangeEvent } from '@ali/ide-editor/lib/browser';
import { DocumentSymbolChangedEvent } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';

export type OpenedEditorData = IEditorGroup | IResource;
export interface OpenedEditorEvent {
  group: IEditorGroup;
  resource: IResource;
}

@Injectable()
export class OutlineEventService extends WithEventBus {

  private _onDidChange: Emitter<URI | null> = new Emitter();
  private _onDidSelectionChange: Emitter<URI | null> = new Emitter();
  private _onDidActiveChange: Emitter<URI | null> = new Emitter();

  constructor() {
    super();
  }

  get onDidChange(): Event<URI | null> {
    return this._onDidChange.event;
  }

  get onDidActiveChange(): Event<URI | null> {
    return this._onDidActiveChange.event;
  }

  get onDidSelectionChange(): Event<URI | null> {
    return this._onDidSelectionChange.event;
  }

  @OnEvent(EditorActiveResourceStateChangedEvent)
  onEditorActiveResourceStateChangedEvent(e: EditorActiveResourceStateChangedEvent) {
    this._onDidActiveChange.fire(e.payload.editorUri!);
  }

  @OnEvent(EditorSelectionChangeEvent)
  onEditorSelectionChangeEvent(e: EditorSelectionChangeEvent) {
    this._onDidSelectionChange.fire(e.payload.editorUri);
  }

  @OnEvent(DocumentSymbolChangedEvent)
  onDocumentSymbolChange(e: DocumentSymbolChangedEvent) {
    this._onDidChange.fire(e.payload);
  }
}
