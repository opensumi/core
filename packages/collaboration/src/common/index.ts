export const ICollaborationService = Symbol('ICollaborationService');

export interface ICollaborationService {
  initialize(): void;
  undoOnCurrentBinding(): void;
  redoOnCurrentBinding(): void;
}
