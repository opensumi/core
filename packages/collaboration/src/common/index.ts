import * as Y from 'yjs';

export const ICollaborationService = Symbol('ICollaborationService');

export interface ICollaborationService {
  initialize(): void;
  destroy(): void;
  undoOnCurrentResource(): void;
  redoOnCurrentResource(): void;
}

export const IYWebsocketServer = Symbol('IYWebsocketServer');

export interface IYWebsocketServer {
  getYDoc(room: string): Y.Doc;
}

export const CollaborationServiceForClientPath = 'CollaborationServiceForClientPath';

export const ICollaborationServiceForClient = Symbol('ICollaborationServiceForClient');

export interface ICollaborationServiceForClient {
  removeYText(uri: string): void;
  requestInitContent(uri: string): Promise<void>;
}

export const ROOM_NAME = 'y-room-opensumi';
