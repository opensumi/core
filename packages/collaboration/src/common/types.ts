import { ICodeEditor } from '@opensumi/ide-monaco';

export const ICollaborationService = Symbol('ICollaborationService');

export interface ICollaborationService {
  initialize(): void;
  destroy(): void;
  undoOnCurrentResource(): void;
  redoOnCurrentResource(): void;
  getUseInfo(): UserInfo;
  setUserInfo(contribution: UserInfoForCollaborationContribution): void;
}

export const IYWebsocketServer = Symbol('IYWebsocketServer');

export interface IYWebsocketServer {
  requestInitContent(uri: string): Promise<void>;
}

export const CollaborationServiceForClientPath = 'CollaborationServiceForClientPath';

export const ICollaborationServiceForClient = Symbol('ICollaborationServiceForClient');

export interface ICollaborationServiceForClient {
  requestInitContent(uri: string): Promise<void>;
}

export const ROOM_NAME = 'y-room-opensumi';

// user model for collaboration module
export const UserInfoForCollaborationContribution = Symbol('UserInfoForCollaborationContribution');

export interface UserInfoForCollaborationContribution {
  info: UserInfo;
}

export interface UserInfo {
  id: string; // unique id
  nickname: string; // will be displayed on live cursor
  // may be more data fields
}

export interface ICursorWidgetRegistry {
  /**
   * update specified position of widget, but not invoke `layoutWidget`
   */
  updatePositionOf(clientID: number, lineNumber: number, column: number): void;
  /**
   * set all position of widget to null
   * @param editor
   */
  removeAllPositions(editor: ICodeEditor): void;
  /**
   * update all position of widget, `layoutWidget` is invoked
   */
  layoutAllWidgets(): void;
  /**
   * destroy this registry and all its widgets
   */
  destroy(): void;
}
