import * as monaco from '@opensumi/ide-monaco';

export interface IMergeRegion {
  name: string;
  header: monaco.Range;
  content: monaco.Range;
  decoratorContent?: monaco.Range;
}

export const enum CommitType {
  Current,
  Incoming,
  Both,
}

export interface IExtensionConfiguration {
  enableCodeLens: boolean;
  enableDecorations: boolean;
  enableEditorOverview: boolean;
}

export interface IDocumentMergeConflict extends IDocumentMergeConflictDescriptor {
  commitEdit(type: CommitType, editor: monaco.editor.ITextModel): Thenable<boolean>;
  applyEdit(
    type: CommitType,
    document: monaco.editor.ITextModel,
    edit: { replace(range: monaco.Range, newText: string): void },
  ): void;
}

export interface IDocumentMergeConflictDescriptor {
  [x: string]: any;
  range: monaco.Range;
  current: IMergeRegion;
  incoming: IMergeRegion;
  commonAncestors: IMergeRegion[];
  splitter: monaco.Range;
}

export interface ICacheDocumentMergeConflict extends IDocumentMergeConflictDescriptor {
  aiContent?: string;
}

export interface IDocumentMergeConflictTracker {
  getConflicts(document: monaco.editor.ITextModel): PromiseLike<IDocumentMergeConflict[]>;
  isPending(document: monaco.editor.ITextModel): boolean;
  forget(document: monaco.editor.ITextModel): void;
}

export interface IDocumentMergeConflictTrackerService {
  createTracker(origin: string): IDocumentMergeConflictTracker;
  forget(document: monaco.editor.ITextModel): void;
}

export interface IDocumentMergeConflictNavigationResults {
  canNavigate: boolean;
  conflict?: IDocumentMergeConflict;
}

export enum NavigationDirection {
  Forwards,
  Backwards,
}

export namespace AI_COMMAND {
  const MERGE_CONFLICT = 'merge-conflict';
  export const ACCEPT = `${MERGE_CONFLICT}.ai.accept`;
  export const REVERT = `${MERGE_CONFLICT}.ai.revert`;
}
