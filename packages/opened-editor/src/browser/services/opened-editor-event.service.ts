import { Injectable } from '@opensumi/di';
import { Emitter, Event, OnEvent, WithEventBus } from '@opensumi/ide-core-browser';
import {
  IEditorGroup,
  IResource,
  IResourceDecorationChangeEventPayload,
  ResourceDecorationChangeEvent,
} from '@opensumi/ide-editor';
import { EditorGroupCloseEvent, EditorGroupDisposeEvent, EditorGroupOpenEvent } from '@opensumi/ide-editor/lib/browser';

export type OpenedEditorData = IEditorGroup | IResource;
export interface OpenedEditorEvent {
  group: IEditorGroup;
  resource: IResource;
}

@Injectable()
export class OpenedEditorEventService extends WithEventBus {
  private _onDidChange: Emitter<OpenedEditorEvent | null> = new Emitter();
  private _onDidDecorationChange: Emitter<IResourceDecorationChangeEventPayload | null> = new Emitter();
  private _onDidActiveChange: Emitter<OpenedEditorEvent | null> = new Emitter();

  public onDidChange: Event<OpenedEditorEvent | null> = this._onDidChange.event;
  public onDidDecorationChange: Event<IResourceDecorationChangeEventPayload | null> = this._onDidDecorationChange.event;
  public onDidActiveChange: Event<OpenedEditorEvent | null> = this._onDidActiveChange.event;

  constructor() {
    super();
  }

  @OnEvent(EditorGroupOpenEvent)
  onEditorGroupOpenEvent(e: EditorGroupOpenEvent) {
    this._onDidActiveChange.fire(e.payload);
  }

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupCloseEvent() {
    this._onDidChange.fire(null);
  }

  @OnEvent(EditorGroupDisposeEvent)
  onEditorGroupDisposeEvent() {
    this._onDidChange.fire(null);
  }

  // 为修改的文件添加dirty装饰
  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationChangeEvent) {
    this._onDidDecorationChange.fire(e.payload);
  }
}
