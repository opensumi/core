import { OpenSumiApp } from './app';
import { OpenSumiFileTreeView } from './filetree-view';
import { OpenSumiOpenedEditorView } from './opened-editor-view';
import { OpenSumiOutlineView } from './outline-view';
import { OpenSumiPanel } from './panel';
import { OpenSumiTreeNode } from './tree-node';

export class OpenSumiExplorerFileStatNode extends OpenSumiTreeNode {
  async getFsPath() {
    return await this.elementHandle.getAttribute('title');
  }

  async isFolder() {
    const icon = await this.elementHandle.$("[class*='file_icon___']");
    if (!icon) {
      return false;
    }
    const className = await icon.getAttribute('class');
    return className?.includes('folder-icon');
  }

  async getMenuItemByName(name: string) {
    const contextMenu = await this.openContextMenu();
    const menuItem = await contextMenu.menuItemByName(name);
    return menuItem;
  }

  async open(preview = true) {
    if (!preview) {
      await this.elementHandle?.dblclick();
    } else {
      await this.elementHandle?.click();
    }
  }

  async isDirty() {
    const classname = await this.elementHandle.getAttribute('class');
    if (classname?.includes('dirty__')) {
      return true;
    }
    return false;
  }
}

export class OpenSumiExplorerOpenedEditorNode extends OpenSumiTreeNode {
  async getRelativePath() {
    return await (await this.elementHandle.$('[class*="opened_editor_node_description__"]'))?.textContent();
  }

  async getFsPath() {
    return await this.elementHandle.getAttribute('title');
  }

  async isGroup() {
    const icon = await this.elementHandle.waitForSelector("[class*='file_icon___']");
    const className = await icon.getAttribute('class');
    return className?.includes('folder-icon');
  }

  async getMenuItemByName(name: string) {
    const contextMenu = await this.openContextMenu();
    const menuItem = await contextMenu.menuItemByName(name);
    return menuItem;
  }

  async open() {
    await this.elementHandle.click();
  }
}

export class OpenSumiExplorerView extends OpenSumiPanel {
  private _fileTreeView: OpenSumiFileTreeView;
  private _openedEditorView: OpenSumiOpenedEditorView;
  private _outlineView: OpenSumiOutlineView;

  constructor(app: OpenSumiApp) {
    super(app, 'EXPLORER');
    this._openedEditorView = new OpenSumiOpenedEditorView(this.app);
    this._outlineView = new OpenSumiOutlineView(this.app);
  }

  initFileTreeView(name: string) {
    this._fileTreeView = new OpenSumiFileTreeView(this.app, name);
  }

  get fileTreeView() {
    return this._fileTreeView;
  }

  get openedEditorView() {
    return this._openedEditorView;
  }

  get outlineView() {
    return this._outlineView;
  }

  async getFileStatTreeNodeByPath(path: string) {
    const treeItems = await (await this.fileTreeView.getViewElement())?.$$('[class*="file_tree_node__"]');
    if (!treeItems) {
      return;
    }
    let node;
    for (const item of treeItems) {
      const title = await item.getAttribute('title');
      if (title?.startsWith('Group')) {
        if (title === path) {
          node = item;
          break;
        }
      } else {
        // The title maybe `~/a.js • Untracked`
        if (title?.split(' ')[0]?.endsWith(path)) {
          node = item;
          break;
        }
      }
    }
    if (node) {
      return new OpenSumiExplorerFileStatNode(node, this.app);
    }
  }

  async getOpenedEditorTreeNodeByPath(path: string) {
    const treeItems = await (await this.openedEditorView.getViewElement())?.$$('[class*="opened_editor_node__"]');
    if (!treeItems) {
      return;
    }
    let node;
    for (const item of treeItems) {
      const title = await item.getAttribute('title');
      if (title?.startsWith('GROUP')) {
        if (title === path) {
          node = item;
          break;
        }
      } else {
        // The title maybe `~/a.js • Untracked`
        if (title?.split(' ')[0]?.endsWith(path)) {
          node = item;
          break;
        }
      }
    }
    if (node) {
      return new OpenSumiExplorerFileStatNode(node, this.app);
    }
  }
}
