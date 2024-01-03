import { CommandService, URI, formatLocalize, path } from '@opensumi/ide-core-browser';
import { ScmChangeTitleCallback } from '@opensumi/ide-core-browser/lib/menu/next';
import { ZoneWidget } from '@opensumi/ide-monaco-enhance/lib/browser';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';

import { IDirtyDiffModel, OPEN_DIRTY_DIFF_WIDGET } from '../../common';

import { ChangeType, getChangeType, toChange } from './dirty-diff-util';

import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

export enum DirtyDiffWidgetActionType {
  close,
  save,
  reset,
  next,
  previous,
}

export class DirtyDiffWidget extends ZoneWidget {
  protected _fillContainer(container: HTMLElement): void {}
  private _wrapper: HTMLDivElement;
  private _head: HTMLDivElement;
  private _content: HTMLDivElement;

  private _title: HTMLDivElement;
  private _actions: HTMLDivElement;

  private _model: IDirtyDiffModel;
  private _currentChangeIndex = 0;

  private get uri(): URI {
    // vscode 用的是 this.model.modified!.uri
    return URI.from(this.editor.getModel()!.uri);
  }

  constructor(editor: IMonacoCodeEditor, dirtyModel: IDirtyDiffModel, readonly commandService: CommandService) {
    super(editor);

    this._model = dirtyModel;
    this._wrapper = document.createElement('div');
    this._head = document.createElement('div');
    this._content = document.createElement('div');
    this._container.appendChild(this._wrapper);
    this._wrapper.appendChild(this._head);
    this._wrapper.appendChild(this._content);
  }

  get currentIndex() {
    return this._currentChangeIndex;
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
    detail.innerText = formatLocalize('scm.dirtyDiff.changes', this._currentChangeIndex, this._model.changes.length);
    this._title.appendChild(detail);
  }

  private getBorderColor(changeType: ChangeType) {
    switch (changeType) {
      case ChangeType.Add:
        return 'var(--editorGutter-addedBackground)';
      case ChangeType.Modify:
        return 'var(--editorGutter-modifiedBackground)';
      case ChangeType.Delete:
        return 'var(--editorGutter-deletedBackground)';
    }
  }

  protected applyClass() {
    this._wrapper.className = 'dirty-diff-widget-wrapper';
    this._head.className = 'dirty-diff-widget-header';
    this._content.className = 'dirty-diff-widget-content';

    // 实际外部传入的是数量而非 index，这里获取 change 需要 - 1
    const change = this._model.changes[this._currentChangeIndex - 1];
    const changeType = getChangeType(change);
    // 根据当前 changType 渲染不同的边框颜色
    const borderColor = this.getBorderColor(changeType);
    this._head.style.borderTopColor = borderColor;
    this._head.style.borderBottomColor = borderColor;

    this._content.style.borderBottomColor = borderColor;

    // 根据编辑器字号行高设置 header 和 content 高度
    const editorLineHeight = this.editor.getOption(EditorOption.lineHeight /** EditorOption.lineHeight */);
    const headHeight = Math.ceil(editorLineHeight * 1.2);

    this._head.style.height = `${headHeight}px`;

    this._renderTitle();

    const model = this.editor.getModel();

    if (!model) {
      throw new Error('Not found model');
    }

    this._title.innerText = path.basename(model.uri.path);
    this._title.className = 'file-name';
    this._actions.className = 'file-actions';

    this._renderActions();
  }

  getContentNode() {
    return this._content;
  }

  private _renderTitle() {
    if (this._head.children.length === 0) {
      this._title = document.createElement('div');
      this._actions = document.createElement('div');
      this._head.appendChild(this._title);
      this._head.appendChild(this._actions);
    }
  }

  private _addAction(icon: string, type: DirtyDiffWidgetActionType) {
    const action = document.createElement('div');
    action.className = `kt-icon codicon codicon-${icon}`;
    this._actions.appendChild(action);
    action.onclick = () => this.handleAction(type);
    return action;
  }

  private _renderActions() {
    if (this._actions.children.length === 0) {
      this._addAction('add', DirtyDiffWidgetActionType.save);
      this._addAction('discard', DirtyDiffWidgetActionType.reset);
      this._addAction('arrow-up', DirtyDiffWidgetActionType.next);
      this._addAction('arrow-down', DirtyDiffWidgetActionType.previous);
      this._addAction('close', DirtyDiffWidgetActionType.close);
    }
  }

  relayout(heightInLines: number) {
    this._relayout(heightInLines);
  }

  protected handleAction(type: DirtyDiffWidgetActionType) {
    let lineNumber: number;
    /**
     * FIXME: 这里命名一致性差
     * 父组件内部的 currentRange
     * 子组件内部有 _currentIndex, 但是方法却是 updateCurrent
     */
    const current = this.currentRange;

    const args: Parameters<ScmChangeTitleCallback> = [
      this.uri,
      this._model.changes.map(toChange),
      this._currentChangeIndex - 1,
    ];

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
        this.commandService.executeCommand('git.stageChange', ...args);
        this.dispose();
        break;
      case DirtyDiffWidgetActionType.reset:
        this.commandService.executeCommand('git.revertChange', ...args);
        this.dispose();
        break;
      case DirtyDiffWidgetActionType.close:
        this.dispose();
        break;
      default:
        break;
    }
  }
}
