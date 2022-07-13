import * as Y from 'yjs';

export const ICollaborationService = Symbol('ICollaborationService');

export interface ICollaborationService {
  initialize(): void;
  destroy(): void;
  undoOnCurrentBinding(): void;
  redoOnCurrentBinding(): void;
}

export const IYWebsocketServer = Symbol('IYWebsocketServer');

export interface IYWebsocketServer {
  getYDoc(room: string): Y.Doc;
}

export const CollaborationServiceForClientPath = 'CollaborationServiceForClientPath';

export const ICollaborationServiceForClient = Symbol('ICollaborationServiceForClient');

export interface ICollaborationServiceForClient {
  setInitContent(uri: string, initContent: string): void;
}

export const ROOM_NAME = 'y-room-opensumi';
