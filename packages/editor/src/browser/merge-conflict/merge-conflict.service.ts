import { Autowired, Injectable } from '@opensumi/di';
import { formatLocalize } from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/ide-monaco';
import { IMessageService } from '@opensumi/ide-overlay';

import { IEditor, WorkbenchEditorService } from '../types';

import { DocumentMergeConflict, MergeConflictParser } from './conflict-parser';

interface IDocumentMergeConflictNavigationResults {
  canNavigate: boolean;
  conflict?: DocumentMergeConflict;
}

enum NavigationDirection {
  Forwards,
  Backwards,
}

@Injectable()
export class MergeConflictService {
  @Autowired(MergeConflictParser)
  parser: MergeConflictParser;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  conflicts = [] as DocumentMergeConflict[];
  summary = '';

  scanDocument(model: monaco.editor.ITextModel) {
    this.conflicts = this.parser.scanDocument(model);
    const summary = formatLocalize('merge-conflicts.merge.conflict.remain', this.conflicts.length);
    this.summary = summary;
    return this.conflicts.length;
  }

  clear(): void {
    this.conflicts = [];
  }

  private async findConflictForNavigation(
    editor: IEditor,
    direction: NavigationDirection,
    conflicts?: DocumentMergeConflict[],
  ): Promise<IDocumentMergeConflictNavigationResults | null> {
    if (!conflicts) {
      conflicts = this.parser.scanDocument(editor.monacoEditor.getModel()!);
    }

    if (!conflicts || conflicts.length === 0) {
      return null;
    }

    const selection = editor.monacoEditor.getSelection()!;
    if (conflicts.length === 1) {
      if (conflicts[0].range.containsRange(selection)) {
        return {
          canNavigate: false,
        };
      }

      return {
        canNavigate: true,
        conflict: conflicts[0],
      };
    }

    let predicate: (_conflict: any) => boolean;
    let fallback: () => DocumentMergeConflict;
    let scanOrder: DocumentMergeConflict[];

    const selectionStart = selection.getStartPosition();

    if (direction === NavigationDirection.Forwards) {
      predicate = (conflict: DocumentMergeConflict) =>
        monaco.Position.isBefore(selectionStart, conflict.range.getStartPosition());
      fallback = () => conflicts![0];
      scanOrder = conflicts;
    } else if (direction === NavigationDirection.Backwards) {
      predicate = (conflict: DocumentMergeConflict) =>
        monaco.Position.isBefore(conflict.range.getStartPosition(), selectionStart);
      fallback = () => conflicts![conflicts!.length - 1];
      scanOrder = conflicts.slice().reverse();
    } else {
      throw new Error(`Unsupported direction ${direction}`);
    }

    for (const conflict of scanOrder) {
      if (predicate(conflict) && !conflict.range.containsPosition(selectionStart)) {
        return {
          canNavigate: true,
          conflict,
        };
      }
    }

    // Went all the way to the end, return the head
    return {
      canNavigate: true,
      conflict: fallback(),
    };
  }

  private async navigate(editor: IEditor, direction: NavigationDirection): Promise<void> {
    const navigationResult = await this.findConflictForNavigation(editor, direction);

    if (!navigationResult) {
      this.messageService.warning('No merge conflicts found in this file');
      return;
    } else if (!navigationResult.canNavigate) {
      this.messageService.warning('No other merge conflicts within this file');
      return;
    } else if (!navigationResult.conflict) {
      // TODO: Show error message?
      return;
    }

    editor.monacoEditor.setPosition(navigationResult.conflict.range.getStartPosition());

    // when navigating, we want to show the codelens on the first line of the conflict
    const range = navigationResult.conflict.range.delta(-1);

    editor.monacoEditor.revealRange(range);
  }

  navigateNext(): Promise<void> {
    return this.navigate(this.editorService.currentEditor!, NavigationDirection.Forwards);
  }

  navigatePrevious(): Promise<void> {
    return this.navigate(this.editorService.currentEditor!, NavigationDirection.Backwards);
  }
}
