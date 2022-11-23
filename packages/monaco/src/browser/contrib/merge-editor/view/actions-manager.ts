import { Disposable } from '@opensumi/ide-core-common';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';

import { IActionsDescription } from '../types';

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

    const handleMouseDown = (e: IEditorMouseEvent, _this: BaseCodeEditor) => {
      const provider = _this.actionsProvider;
      if (!provider) {
        return;
      }

      let { mouseDownGuard } = provider;
      const { onActionsClick, provideActionsItems } = provider;

      if (typeof mouseDownGuard === 'undefined') {
        const items = provideActionsItems();
        mouseDownGuard = (e: IEditorMouseEvent) => {
          if (e.event.rightButton) {
            return false;
          }

          if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
            return false;
          }

          const { position } = e.target;

          if (!items.some((item: IActionsDescription) => item.range.startLineNumber === position.lineNumber)) {
            return false;
          }

          return true;
        };
      }

      if (mouseDownGuard(e) === true && onActionsClick) {
        onActionsClick.call(_this, e, currentView, resultView, incomingView);
      }
    };

    this.addDispose(currentView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, currentView)));
    this.addDispose(incomingView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, incomingView)));
    this.addDispose(resultView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, resultView)));
  }
}
