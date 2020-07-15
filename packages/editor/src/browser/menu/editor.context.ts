import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, Domain, IContextKeyService } from '@ali/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { IEditor } from '../../common';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '../types';

@Injectable({multiple: true})
export class EditorContextMenuController extends Disposable {

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  private readonly contextKeyService: IContextKeyService;

  constructor(private editor: IEditor) {
    super();
    this.addDispose(editor.monacoEditor.onContextMenu((e) => {
      this.onContextMenu(e);
    }));

    this.contextKeyService = this.registerDispose(this.globalContextKeyService.createScoped((this.editor.monacoEditor as any)._contextKeyService));
  }

  private onContextMenu(e) {
    // 这段判断来自monacoEditor
    if (!this.editor.currentDocumentModel) {
      return;
    }
    if (!this.editor.monacoEditor.getConfiguration().contribInfo.contextmenu) {
        this.editor.monacoEditor.focus();
        // Ensure the cursor is at the position of the mouse click
        if (e.target.position && this.editor.monacoEditor.getSelection() && !this.editor.monacoEditor.getSelection()!.containsPosition(e.target.position)) {
            this.editor.monacoEditor.setPosition(e.target.position);
        }
        return; // Context menu is turned off through configuration
    }
    if (e.target.type === 12 /* OVERLAY_WIDGET */) {
        return; // allow native menu on widgets to support right click on input field for example in find
    }
    e.event.preventDefault();
    if (e.target.type !== 6 /* CONTENT_TEXT */ && e.target.type !== 7 /* CONTENT_EMPTY */ && e.target.type !== 1 /* TEXTAREA */) {
        return; // only support mouse click into text or native context menu key for now
    }
    // Ensure the editor gets focus if it hasn't, so the right events are being sent to other contributions
    this.editor.monacoEditor.focus();
    // Ensure the cursor is at the position of the mouse click
    if (e.target.position && this.editor.monacoEditor.getSelection() && !this.editor.monacoEditor.getSelection()!.containsPosition(e.target.position)) {
        this.editor.monacoEditor.setPosition(e.target.position);
    }
    // Unless the user triggerd the context menu through Shift+F10, use the mouse position as menu position
    let anchor: {x: number, y: number } | undefined;
    if (e.target.type !== 1 /* TEXTAREA */) {
        anchor = { x: e.event.posx - 1, y: e.event.posy - 1 };
    }
    // Show the context menu
    this.showContextMenu(anchor);
  }

  private showContextMenu(anchor: {x: number, y: number } = {x: 0, y: 0}) {
    const contextMenu = this.contextMenuService.createMenu({
      id: MenuId.EditorContext,
      contextKeyService: this.contextKeyService,
    });
    const menuNodes = contextMenu.getMergedMenuNodes();
    contextMenu.dispose();

    this.contextMenuRenderer.show({
      anchor,
      menuNodes,
      args: [ this.editor.currentUri ],
      onHide: (canceled) => {
        if (!canceled) {
          this.editor.monacoEditor.focus();
        }
      },
    });
  }

}

@Domain(BrowserEditorContribution)
export class EditorContextMenuBrowserEditorContribution implements BrowserEditorContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        return this.injector.get(EditorContextMenuController, [editor]);
      },
    });
  }

}
