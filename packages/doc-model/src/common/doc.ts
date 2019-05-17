import {
  Uri,
  IDisposableRef,
} from '@ali/ide-core-common';
import {
  Event,
} from '@ali/ide-core-common';

export interface IDocumentModelMirror {
  uri?: string;
  lines?: string[];
  eol?: string;
  encoding?: string;
  language?: string;
}

export interface IDocumentModel extends IDisposableRef<IDocumentModel> {
  uri: Uri;
  lines: string[];
  eol: string;
  encoding: string;
  language: string;

  // 转化为编辑器的内置数据类型。
  toEditor(): monaco.editor.IModel | null;
  // 可序列化的 pure object。
  toMirror(): IDocumentModelMirror;
  // 从可序列化的 pure object 更新 doc。
  fromMirror(mirror: IDocumentModelMirror): void;

  // TODO: more functions
}

export interface IDocumentChangedEvent {
  uri: Uri,
  mirror: IDocumentModelMirror,
}

export interface IDocumentCreatedEvent {
  uri: Uri,
}

export interface IDocumentRemovedEvent {
  uri: Uri,
}

export interface IDocumentRenamedEvent {
  from: Uri,
  to: Uri,
}

export interface IDocumentModelProvider {
  initialize: (uri: string | Uri) => Promise<IDocumentModel | null>,

  // event
  onCreated: Event<IDocumentCreatedEvent>,
  onChanged: Event<IDocumentChangedEvent>,
  onRenamed: Event<IDocumentRenamedEvent>,
  onRemoved: Event<IDocumentRemovedEvent>,
}
