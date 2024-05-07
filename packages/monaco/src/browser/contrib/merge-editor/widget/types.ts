import { ICodeEditor } from '../../../monaco-api/types';
import { IConflictActionsEvent } from '../types';

export interface IMergeEditorShape {
  editor: ICodeEditor;

  launchConflictActionsEvent(eventData: Omit<IConflictActionsEvent, 'withViewType'>): void;
  hideResolveResultWidget(id?: string | undefined): void;

  hideStopWidget(id?: string): void;
  cancelRequestToken(id?: string): void;
}
