import { Disposable } from '@ali/ide-core-common/lib/disposable';

export class DirtyDiffController extends Disposable {

  private static readonly ID = 'editor.contrib.dirtydiff';

  static get(editor: monaco.editor.ICodeEditor): DirtyDiffController {
    // return editor.getContribution<DirtyDiffController>(DirtyDiffController.ID);
    return editor.getContribution<any>(DirtyDiffController.ID);
  }
}
