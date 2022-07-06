import { Disposable, IContextKeyService } from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { ICodeEditor } from '@opensumi/ide-monaco/lib/common/types';
import * as dom from '@opensumi/monaco-editor-core/esm/vs/base/browser/dom';
import { IAnchor } from '@opensumi/monaco-editor-core/esm/vs/base/browser/ui/contextview/contextview';
import { KeyCode } from '@opensumi/monaco-editor-core/esm/vs/base/common/keyCodes';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { IEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { ContextMenuController } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/contextmenu/browser/contextmenu';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export class EditorContextMenuController extends Disposable implements IEditorContribution {
  public static readonly ID = 'editor.contrib.contextmenu';

  public static get(editor: ICodeEditor): ContextMenuController | null {
    return editor.getContribution<ContextMenuController>(ContextMenuController.ID);
  }

  private readonly contextKeyService: IContextKeyService;

  constructor(
    private readonly contextMenuService: AbstractContextMenuService,
    private readonly globalContextKeyService: IContextKeyService,
    private readonly contextMenuRenderer: ICtxMenuRenderer,
    private codeEditor: ICodeEditor,
  ) {
    super();
    this.contextKeyService = this.registerDispose(
      this.globalContextKeyService.createScoped((this.codeEditor as any)._contextKeyService),
    );
    this.addDispose(this.codeEditor.onContextMenu((e) => this.onContextMenu(e)));
    this.addDispose(
      this.codeEditor.onKeyDown((e) => {
        if (e.keyCode === KeyCode.ContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu();
        }
      }),
    );
  }

  showContextMenu(anchor?: IAnchor | null): void {
    if (!this.codeEditor.getOption(EditorOption.contextmenu)) {
      return; // Context menu is turned off through configuration
    }
    if (!this.codeEditor.hasModel()) {
      return;
    }

    if (!this.contextMenuService) {
      this.codeEditor.focus();
      return; // We need the context menu service to function
    }

    // Find actions available for menu
    const menuNodes = this.getMenuNodes();
    // Show menu if we have actions to show
    if (menuNodes.length > 0) {
      this._doShowContextMenu(menuNodes, anchor);
    }
  }

  // ref: https://github.com/microsoft/vscode/blob/1498d0f34053f854e75e1364adaca6f99e43de08/src/vs/editor/contrib/contextmenu/browser/contextmenu.ts
  private onContextMenu(e: IEditorMouseEvent) {
    if (!this.codeEditor.hasModel()) {
      return;
    }

    if (!this.codeEditor.getOption(EditorOption.contextmenu)) {
      this.codeEditor.focus();
      // Ensure the cursor is at the position of the mouse click
      if (e.target.position && !this.codeEditor.getSelection().containsPosition(e.target.position)) {
        this.codeEditor.setPosition(e.target.position);
      }
      return; // Context menu is turned off through configuration
    }

    if (e.target.type === MouseTargetType.OVERLAY_WIDGET) {
      return; // allow native menu on widgets to support right click on input field for example in find
    }
    if (e.target.type === MouseTargetType.CONTENT_TEXT && e.target.detail.injectedText) {
      return; // allow native menu on injected text
    }

    e.event.preventDefault();
    e.event.stopPropagation();

    if (
      e.target.type !== MouseTargetType.CONTENT_TEXT &&
      e.target.type !== MouseTargetType.CONTENT_EMPTY &&
      e.target.type !== MouseTargetType.TEXTAREA
    ) {
      return; // only support mouse click into text or native context menu key for now
    }

    // Ensure the editor gets focus if it hasn't, so the right events are being sent to other contributions
    this.codeEditor.focus();

    // Ensure the cursor is at the position of the mouse click
    if (e.target.position) {
      let hasSelectionAtPosition = false;
      for (const selection of this.codeEditor.getSelections()) {
        if (selection.containsPosition(e.target.position)) {
          hasSelectionAtPosition = true;
          break;
        }
      }

      if (!hasSelectionAtPosition) {
        this.codeEditor.setPosition(e.target.position);
      }
    }

    // Unless the user triggerd the context menu through Shift+F10, use the mouse position as menu position
    let anchor: IAnchor | null = null;
    if (e.target.type !== MouseTargetType.TEXTAREA) {
      anchor = { x: e.event.posx - 1, width: 2, y: e.event.posy - 1, height: 2 };
    }

    // Show the context menu
    this.showContextMenu(anchor);
  }

  private _doShowContextMenu(menuNodes: any[], anchor?: IAnchor | null) {
    const editor = this.codeEditor;
    // https://github.com/microsoft/vscode/blob/master/src/vs/editor/contrib/contextmenu/contextmenu.ts#L196
    if (!editor.hasModel()) {
      return;
    }

    // Disable hover
    const oldHoverSetting = editor.getOption(monaco.editor.EditorOption.hover);
    editor.updateOptions({
      hover: {
        enabled: false,
      },
    });

    if (!anchor) {
      // Ensure selection is visible
      editor.revealPosition(editor.getPosition(), monaco.editor.ScrollType.Immediate);

      editor.render();
      const cursorCoords = editor.getScrolledVisiblePosition(editor.getPosition());

      // Translate to absolute editor position
      const editorCoords = dom.getDomNodePagePosition(editor.getDomNode());
      const posx = editorCoords.left + cursorCoords.left;
      const posy = editorCoords.top + cursorCoords.top + cursorCoords.height;

      anchor = { x: posx, y: posy };
    }

    // Show the context menu
    this.contextMenuRenderer.show({
      anchor: {
        x: anchor.x - window.scrollX,
        y: anchor.y - window.scrollY,
      },
      menuNodes,
      args: [editor.getModel().uri],
      onHide: () => {
        // 无论是否取消都应该恢复 hover 的设置
        this.codeEditor.updateOptions({
          hover: oldHoverSetting,
        });

        // 右键菜单关闭后应该使编辑器重新 focus
        // 原因是一些内置的 command (copy/cut/paste) 在执行时会在对应的 focusedEditor 执行，如果找不到 focusedEditor 则不会执行命令
        this.codeEditor.focus();
      },
    });
  }

  private getMenuNodes() {
    const contextMenu = this.contextMenuService.createMenu({
      id: MenuId.EditorContext,
      contextKeyService: this.contextKeyService,
    });
    const menuNodes = contextMenu.getMergedMenuNodes();
    contextMenu.dispose();
    return menuNodes;
  }
}
