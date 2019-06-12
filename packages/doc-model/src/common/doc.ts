import {
  URI,
  IDisposableRef,
  IDisposable,
} from '@ali/ide-core-common';
import {
  Event,
} from '@ali/ide-core-common';
import {
  IVersion,
} from './version';

export interface IDocumentModelMirror {
  uri: string;
  lines: string[];
  eol: string;
  encoding: string;
  language: string;
  base?: IVersion;
}

export interface IRange {
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
}

export interface IDocumentModelContentChange {
  range: IRange;
  text: string;
  rangeLength: number;
  rangeOffset: number;
}

export interface IDocumentModel extends IDisposableRef<IDocumentModel> {
  uri: URI;
  lines: string[];
  eol: string;
  encoding: string;
  language: string;
  version: IVersion;
  dirty: boolean;

  applyChange(changes: IDocumentModelContentChange[]): void;
  getText(range?: IRange): string;

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

export interface IDocumentModeContentProvider {
  build: (uri: URI) => Promise<IDocumentModelMirror | undefined | null>;
  watch: (uri: string | URI) => Promise<number>;
  unwatch: (id: number) => Promise<void>;
  persist: (mirror: IDocumentModelMirror) => Promise<IDocumentModelMirror | null>;

  // event
  onCreated: Event<IDocumentCreatedEvent>;
  onChanged: Event<IDocumentChangedEvent>;
  onRenamed: Event<IDocumentRenamedEvent>;
  onRemoved: Event<IDocumentRemovedEvent>;
}
