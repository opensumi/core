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

  // 更新文字内容。
  update(content: string): Promise<void>;
  // 转化为编辑器的内置数据类型。
  toEditor(): any;
  // 可序列化的 pure object。
  toMirror(): IDocumentModelMirror;
  // 被析构时。
  onDispose: Event<void>;

  // TODO: more functions
}

export interface IDocumentChangedEvent {
  uri: URI,
  mirror: IDocumentModelMirror,
}

export interface IDocumentCreatedEvent {
  uri: URI,
}

export interface IDocumentRemovedEvent {
  uri: URI,
}

export interface IDocumentRenamedEvent {
  from: URI,
  to: URI,
}

export interface IDocumentModeContentProvider {
  build: (uri: URI) => Promise<IDocumentModelMirror | null>,
  watch: (uri: URI) => IDisposable,

  // event
  onCreated: Event<IDocumentCreatedEvent>,
  onChanged: Event<IDocumentChangedEvent>,
  onRenamed: Event<IDocumentRenamedEvent>,
  onRemoved: Event<IDocumentRemovedEvent>,
}
