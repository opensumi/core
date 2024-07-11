import { Autowired, Injectable } from '@opensumi/di';
import * as monaco from '@opensumi/ide-monaco';
import { NavigationDirection, findRangeForNavigation } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor';
import { IMessageService } from '@opensumi/ide-overlay';

import { IEditor, WorkbenchEditorService } from '../types';

import { DocumentMergeConflict, MergeConflictParser } from './conflict-parser';

@Injectable()
export class MergeConflictService {
  @Autowired(MergeConflictParser)
  parser: MergeConflictParser;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  conflicts = [] as DocumentMergeConflict[];

  scanDocument(model: monaco.editor.ITextModel) {
    this.conflicts = this.parser.scanDocument(model);
    return this.conflicts.length;
  }

  clear(): void {
    this.conflicts = [];
  }

  private async navigate(editor: IEditor, direction: NavigationDirection): Promise<void> {
    this.conflicts = this.parser.scanDocument(editor.monacoEditor.getModel()!);
    const ranges = this.conflicts.map((conflict) => conflict.range);

    const navigationResult = findRangeForNavigation(direction, ranges, editor.monacoEditor.getPosition()!);

    if (!navigationResult) {
      this.messageService.warning('No merge conflicts found in this file');
      return;
    } else if (!navigationResult.canNavigate) {
      this.messageService.warning('No other merge conflicts within this file');
      return;
    } else if (!navigationResult.range) {
      // impossible path
      return;
    }

    editor.monacoEditor.setPosition(navigationResult.range.getStartPosition());

    // when navigating, we want to show the codelens on the first line of the conflict
    const range = navigationResult.range.delta(-1);

    editor.monacoEditor.revealRangeNearTopIfOutsideViewport(range);
    editor.monacoEditor.focus();
  }

  navigateNext(): Promise<void> {
    return this.navigate(this.editorService.currentEditor!, NavigationDirection.Forwards);
  }

  navigatePrevious(): Promise<void> {
    return this.navigate(this.editorService.currentEditor!, NavigationDirection.Backwards);
  }
}
