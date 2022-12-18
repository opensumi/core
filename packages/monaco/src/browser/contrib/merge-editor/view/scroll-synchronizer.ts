import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { IScrollEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

import { BaseCodeEditor } from './editors/baseCodeEditor';
import { CurrentCodeEditor } from './editors/currentCodeEditor';
import { IncomingCodeEditor } from './editors/incomingCodeEditor';
import { ResultCodeEditor } from './editors/resultCodeEditor';

export class ScrollSynchronizer extends Disposable {
  private readonly _onScrollChange = new Emitter<{ event: IScrollEvent; editor: BaseCodeEditor }>();
  public readonly onScrollChange: Event<{ event: IScrollEvent; editor: BaseCodeEditor }> = this._onScrollChange.event;

  constructor() {
    super();
  }

  public mount(currentView: BaseCodeEditor, resultView: BaseCodeEditor, incomingView: BaseCodeEditor): void {
    this.addDispose(
      Event.buffer<{ event: IScrollEvent; editor: BaseCodeEditor }>(this.onScrollChange)(({ event, editor }) => {
        if (!event.scrollTopChanged && !event.scrollLeftChanged && !event.scrollHeightChanged) {
          return;
        }

        let toChanges: [BaseCodeEditor | null, BaseCodeEditor | null] = [null, null];

        if (editor instanceof CurrentCodeEditor) {
          toChanges = [resultView, incomingView];
        } else if (editor instanceof ResultCodeEditor) {
          toChanges = [currentView, incomingView];
        } else if (editor instanceof IncomingCodeEditor) {
          toChanges = [currentView, resultView];
        }

        if (toChanges.length === 2) {
          toChanges.forEach((v: BaseCodeEditor) => {
            v.getEditor().setScrollPosition({
              scrollLeft: event.scrollLeft,
              scrollTop: event.scrollTop,
            });
          });
        }
      }),
    );

    this.addDispose(
      currentView.getEditor().onDidScrollChange((event: IScrollEvent) => {
        this._onScrollChange.fire({ event, editor: currentView });
      }),
    );

    this.addDispose(
      incomingView.getEditor().onDidScrollChange((event: IScrollEvent) => {
        this._onScrollChange.fire({ event, editor: incomingView });
      }),
    );

    this.addDispose(
      resultView.getEditor().onDidScrollChange((event: IScrollEvent) => {
        this._onScrollChange.fire({ event, editor: resultView });
      }),
    );
  }
}
