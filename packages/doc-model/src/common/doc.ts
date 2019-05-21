import {
  URI,
  IDisposableRef,
  IDisposable,
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
  uri: URI;
  lines: string[];
  eol: string;
  encoding: string;
  language: string;
  dirty: boolean;
  // 被析构时
  onDispose: Event<void>;

  // 转化为编辑器的内置数据类型。
  toEditor(): monaco.editor.IModel | null;
  // 可序列化的 pure object。
  toMirror(): IDocumentModelMirror;
  // 从可序列化的 pure object 更新 doc。
  fromMirror(mirror: IDocumentModelMirror): void;

  // TODO: more functions
}

export interface IDocumentChangedEvent {
  uri: URI;
  mirror: IDocumentModelMirror;
}

export interface IDocumentCreatedEvent {
  uri: URI;
}

export interface IDocumentRemovedEvent {
  uri: URI;
}

export interface IDocumentRenamedEvent {
  from: URI;
  to: URI;
}

export interface IDocumentModelProvider {
  build: (uri: string | URI) => Promise<IDocumentModel | null>;
  watch: (uri: string | URI) => IDisposable;

  // event
  onCreated: Event<IDocumentCreatedEvent>;
  onChanged: Event<IDocumentChangedEvent>;
  onRenamed: Event<IDocumentRenamedEvent>;
  onRemoved: Event<IDocumentRemovedEvent>;
}
