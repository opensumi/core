import {
  IDisposable,
  URI,
} from '@ali/ide-core-common';
import {
  IDocumentModel,
  IDocumentModelMirror,
  IDocumentModeContentProvider,
} from './doc';

export * from './const';
export * from './version';
export * from './doc';

export interface INodeDocumentService {
  resolve(uri: string | URI): Promise<IDocumentModelMirror| null>;
  persist(mirror: IDocumentModelMirror, override?: boolean): Promise<IDocumentModelMirror | null>;
}

export interface IDocumentModelManager extends IDisposable {
  resolveModel(uri: string | URI): Promise<IDocumentModel>;
  searchModel(uri: string | URI): Promise<IDocumentModel | null>;
  savetModel(uri: string | URI): Promise<boolean>;
  updateContent(uri: string | URI, content: string): Promise<IDocumentModel>;
  registerDocModelContentProvider(provider: IDocumentModeContentProvider): IDisposable;

  // TODO: more functions
}
