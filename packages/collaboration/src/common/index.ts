import * as Y from 'yjs';

export const ICollaborationService = Symbol('ICollaborationService');

export interface ICollaborationService {
  initialize(): void;
  undoOnCurrentBinding(): void;
  redoOnCurrentBinding(): void;
}

export const IYWebsocketServer = Symbol('IYWebsocketServer');

export interface IYWebsocketServer {
  getYDoc(room: string): Y.Doc;
}
