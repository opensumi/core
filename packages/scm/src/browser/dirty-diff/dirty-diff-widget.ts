import { ZoneWidget } from '@ali/ide-monaco-enhance/lib/browser';
import { basename } from '@ali/ide-core-common/lib/utils/paths';
import { IDirtyDiffModel, OPEN_DIRTY_DIFF_WIDGET } from '../../common';
import { toRange } from './utils';
import { CommandService } from '@ali/ide-core-common';

export enum DirtyDiffWidgetActionType {
  close,
  save,
  reset,
  next,
  previous,
}

export class DirtyDiffWidget extends ZoneWidget {
  private _wrapper: HTMLDivElement;
  private _head: HTMLDivElement;
  private _content: HTMLDivElement;

  private _title: HTMLDivElement;
  private _actions: HTMLDivElement;

  private _model: IDirtyDiffModel;
  private _currentChangeIndex: number = 0;

  constructor(editor: monaco.editor.ICodeEditor, dirtyModel: IDirtyDiffModel, readonly commandService: CommandService) {
    super(editor);

    this._model = dirtyModel;
    this._wrapper = document.createElement('div');
    this._head = document.createElement('div');
    this._content = document.createElement('div');
    this._container.appendChild(this._wrapper);
    this._wrapper.appendChild(this._head);
    this._wrapper.appendChild(this._content);
  }

  updateCurrent(index: number) {
    this._currentChangeIndex = index;
  }

  protected applyStyle() {
    if (!this._title) {
      return;
    }

    if (this._title.children[0]) {
      this._title.removeChild(this._title.children[0]);
    }

    const detail = document.createElement('span');
    detail.className = 'dirty-diff-widget-title-detail';
    detail.innerText = `第 ${this._currentChangeIndex} 个更改（共 ${this._model.changes.length} 个）`;
    this._title.appendChild(detail);
  }

  protected applyClass() {
    this._wrapper.className = 'dirty-diff-widget-wrapper';
    this._head.className = 'dirty-diff-widget-header';
    this._content.className = 'dirty-diff-widget-content';

    this._renderTitle();

    const model = this.editor.getModel();

    if (!model) {
      throw new Error('Not found model');
    }

    this._title.innerText = basename(model.uri.path);
    this._title.className = 'file-name';
    this._actions.className = 'file-actions';

    this._renderActions();
  }

  getContentNode() {
    return this._content;
  }

  private _renderTitle() {
    this._title = document.createElement('div');
    this._actions = document.createElement('div');
    this._head.appendChild(this._title);
    this._head.appendChild(this._actions);
  }

  private _addAction(icon: string, type: DirtyDiffWidgetActionType) {
    const action = document.createElement('div');
    action.className = `kaitian-icon kticon-${icon}`;
    this._actions.appendChild(action);
    action.onclick = () => this.handleAction(type);
    return action;
  }

  private _renderActions() {
    this._addAction('plus', DirtyDiffWidgetActionType.save);
    this._addAction('refresh', DirtyDiffWidgetActionType.reset);
    this._addAction('up', DirtyDiffWidgetActionType.next);
    this._addAction('up', DirtyDiffWidgetActionType.previous);
    this._addAction('close', DirtyDiffWidgetActionType.close);
  }

  relayout(heightInLines: number) {
    this._relayout(heightInLines);
  }

  protected handleAction(type: DirtyDiffWidgetActionType) {
    let lineNumber: number;
    const current = this.currentRange;

    switch (type) {
      case DirtyDiffWidgetActionType.next:
        lineNumber = this._model.findNextClosestChangeLineNumber(current.startLineNumber, false);
        if (lineNumber && lineNumber !== current.startLineNumber) {
          this.commandService.executeCommand(OPEN_DIRTY_DIFF_WIDGET.id, lineNumber);
        }
        break;
      case DirtyDiffWidgetActionType.previous:
        lineNumber = this._model.findPreviousClosestChangeLineNumber(current.startLineNumber, false);
        if (lineNumber && lineNumber !== current.startLineNumber) {
          this.commandService.executeCommand(OPEN_DIRTY_DIFF_WIDGET.id, lineNumber);
        }
        break;
      case DirtyDiffWidgetActionType.save:
        // TODO
        break;
      case DirtyDiffWidgetActionType.reset:
        // TODO
        break;
      case DirtyDiffWidgetActionType.close:
        this.dispose();
        break;
      default:
        break;
    }
  }
}
