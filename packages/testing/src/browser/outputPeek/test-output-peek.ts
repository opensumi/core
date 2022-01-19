import { Injectable, Optional } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';

@Injectable({ multiple: true })
export class TestOutputPeekContribution implements IEditorFeatureContribution {
  private readonly disposer: Disposable = new Disposable();

  constructor(@Optional() private readonly editor: IEditor) {}

  public contribute(): IDisposable {
    return this.disposer;
  }
}
