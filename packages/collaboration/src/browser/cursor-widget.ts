import { Awareness } from 'y-protocols/awareness';

import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { monaco } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import {
  IContentWidget,
  IContentWidgetPosition,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';

import { UserInfo } from '../common';

import { getColorByClientID } from './color';

export interface ICursorWidgetRegistry {
  /**
   * update specified position of widget, but not invoke `layoutWidget`
   * @param id
   * @param pos
   */
  updatePositionOf(clientID: number, lineNumber: number, column: number): void;
  /**
   * set all position of widget to null
   * @param editor
   */
  removeAllPositions(editor: ICodeEditor): void;
  /**
   * update all position of widget, `layoutWidget` is invoked
   */
  layoutAllWidgets(): void;
  /**
   * destroy this registry and all its widgets
   */
  destroy(): void;
}

const createPositionFrom = (lineNumber: number, column: number): IContentWidgetPosition => ({
  position: { lineNumber, column },
  preference: [
    monaco.editor.ContentWidgetPositionPreference.ABOVE,
    monaco.editor.ContentWidgetPositionPreference.BELOW,
  ],
});

/**
 * one editor holds one CursorWidgetRegistry
 */
@Injectable({ multiple: true })
export class CursorWidgetRegistry implements ICursorWidgetRegistry {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  /**
   * store all widgets here, and widgets will be automatically added or removed from this registry
   *
   * clientID => widget
   */
  widgets: Map<number, CursorWidget> = new Map();

  // target editor
  editor: ICodeEditor;

  awareness: Awareness;

  disposable: IDisposable;

  constructor(editor: ICodeEditor, awareness: Awareness) {
    this.editor = editor;
    this.awareness = awareness;
    this.disposable = editor.onDidDispose(() => this.destroy());
    awareness.on('update', this.onAwarenessStateChange);

    this.getWidgetFromRegistry();
  }

  private getWidgetFromRegistry() {
    // create widget from awareness
    this.awareness.getStates().forEach((state, clientID) => {
      const info: UserInfo = state['user-info'];
      if (info) {
        this.createWidget(clientID, info.nickname);
      }
    });
  }

  updatePositionOf(clientID: number, lineNumber: number, column: number) {
    const widget = this.widgets.get(clientID);
    if (widget) {
      widget.position = createPositionFrom(lineNumber, column);
    }
  }

  removeAllPositions() {
    this.widgets.forEach((widget) => {
      widget.position = null;
    });
  }

  layoutAllWidgets() {
    this.widgets.forEach((widget) => {
      this.editor.layoutContentWidget(widget);
    });
  }

  destroy() {
    // remove all from editor
    this.widgets.forEach((widget) => {
      this.editor.removeContentWidget(widget);
    });
    this.awareness.off('update', this.onAwarenessStateChange);
    if (this.disposable) {
      this.disposable.dispose();
    }
  }

  private createWidget(clientID: number, nickname: string) {
    if (!this.widgets.has(clientID)) {
      const widget = this.injector.get(CursorWidget, [nickname, clientID]);
      this.editor.addContentWidget(widget);
      this.widgets.set(clientID, widget);
    }
  }

  private deleteWidget(clientID: number) {
    const widget = this.widgets.get(clientID);
    if (widget) {
      this.editor.removeContentWidget(widget);
      this.widgets.delete(clientID);
    }
  }

  private onAwarenessStateChange = (changes: { added: number[]; updated: number[]; removed: number[] }) => {
    // clientID added, updated or removed
    if (changes.added.length > 0 || changes.updated.length > 0) {
      this.getWidgetFromRegistry();
    }

    if (changes.removed.length > 0) {
      changes.removed.forEach((clientID) => this.deleteWidget(clientID));
    }
  };
}

@Injectable({ multiple: true })
export class CursorWidget implements IContentWidget {
  private domNode: HTMLElement;

  private id: string;

  position: IContentWidgetPosition | null = null;

  constructor(nickname: string, clientID: string) {
    // init dom node
    this.domNode = document.createElement('div');
    this.domNode.innerHTML = nickname;
    this.domNode.style.opacity = '1';
    this.domNode.className = `yRemoteSelection-${clientID}`;
    // set id
    this.id = `cursor-widget-${nickname}`;
  }

  getId(): string {
    return this.id;
  }

  getDomNode(): HTMLElement {
    return this.domNode;
  }

  getPosition(): IContentWidgetPosition | null {
    return this.position;
  }
}
