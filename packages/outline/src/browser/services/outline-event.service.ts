import { Injectable } from '@opensumi/di';
import { Emitter, Event, OnEvent, URI, WithEventBus } from '@opensumi/ide-core-browser';
import { IEditorGroup, IResource } from '@opensumi/ide-editor';
import { EditorActiveResourceStateChangedEvent, EditorSelectionChangeEvent } from '@opensumi/ide-editor/lib/browser';
import { DocumentSymbolChangedEvent } from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';
import { ViewCollapseChangedEvent } from '@opensumi/ide-main-layout';

import { OUTLINE_VIEW_ID } from '../../common/index';

export type OpenedEditorData = IEditorGroup | IResource;
export interface OpenedEditorEvent {
  group: IEditorGroup;
  resource: IResource;
}

@Injectable()
export class OutlineEventService extends WithEventBus {
  private _onDidDocumentSymbolChange: Emitter<URI | null> = new Emitter();
  private _onDidSelectionChange: Emitter<URI | null> = new Emitter();

  private _onDidEditorActiveResourceStateChange: Emitter<URI | null> = new Emitter();
  private _onDidViewCollapseChange: Emitter<boolean> = new Emitter();

  /**
   * on did document symbol changed
   */
  get onDidChange(): Event<URI | null> {
    return this._onDidDocumentSymbolChange.event;
  }
  /**
   * on did editor active resource state changed
   */
  get onDidActiveChange(): Event<URI | null> {
    return this._onDidEditorActiveResourceStateChange.event;
  }

  get onDidSelectionChange(): Event<URI | null> {
    return this._onDidSelectionChange.event;
  }
  get onDidViewCollapseChange(): Event<boolean> {
    return this._onDidViewCollapseChange.event;
  }

  @OnEvent(EditorActiveResourceStateChangedEvent)
  onEditorActiveResourceStateChangedEvent(e: EditorActiveResourceStateChangedEvent) {
    this._onDidEditorActiveResourceStateChange.fire(e.payload.editorUri!);
  }

  @OnEvent(EditorSelectionChangeEvent)
  onEditorSelectionChangeEvent(e: EditorSelectionChangeEvent) {
    this._onDidSelectionChange.fire(e.payload.editorUri);
  }

  @OnEvent(DocumentSymbolChangedEvent)
  onDocumentSymbolChange(e: DocumentSymbolChangedEvent) {
    this._onDidDocumentSymbolChange.fire(e.payload);
  }

  @OnEvent(ViewCollapseChangedEvent)
  onViewCollapseChangedEvent(e: ViewCollapseChangedEvent) {
    if (e.payload.viewId === OUTLINE_VIEW_ID) {
      this._onDidViewCollapseChange.fire(e.payload.collapsed);
    }
  }
}
