import { Disposable } from '@opensumi/ide-core-common';

import { BaseCodeEditor } from './editors/baseCodeEditor';

export class ActionsManager extends Disposable {
  private currentView: BaseCodeEditor | undefined;
  private resultView: BaseCodeEditor | undefined;
  private incomingView: BaseCodeEditor | undefined;

  constructor() {
    super();
  }

  public mount(currentView: BaseCodeEditor, resultView: BaseCodeEditor, incomingView: BaseCodeEditor): void {
    this.currentView = currentView;
    this.resultView = resultView;
    this.incomingView = incomingView;

    this.addDispose(
      this.currentView.getEditor().onMouseDown((e) => {
        const provider = currentView.actionsProvider;
        if (!provider) {
          return;
        }

        const { onActionsClick } = provider;

        if (onActionsClick) {
          onActionsClick.call(currentView, e, currentView, resultView, incomingView);
        }
      }),
    );
  }
}
