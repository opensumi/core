import { Disposable } from '@opensumi/ide-core-common/lib/disposable';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

/* istanbul ignore file */
// 文件没有使用

export class DirtyDiffController extends Disposable {
  private static readonly ID = 'editor.contrib.dirtydiff';

  static get(editor: IMonacoCodeEditor): DirtyDiffController {
    // return editor.getContribution<DirtyDiffController>(DirtyDiffController.ID);
    return editor.getContribution<any>(DirtyDiffController.ID);
  }
}
