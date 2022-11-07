import { OpenSumiApp } from './app';
import { OpenSumiFileTreeView } from './filetree-view';
import { OpenSumiOpenedEditorView } from './opened-editor-view';
import { OpenSumiPanel } from './panel';
import { OpenSumiTreeNode } from './tree-node';

export class OpenSumiSCMFileStatNode extends OpenSumiTreeNode {
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

  async open() {
    await this.elementHandle.click();
  }

  async getBadge() {
    const status = await this.elementHandle.$('[class*="scm_tree_node_status___"]');
    return await status?.textContent();
  }
}

export class OpenSumiSCMView extends OpenSumiPanel {
  private _fileTreeView: OpenSumiFileTreeView;
  private _openedEditorView: OpenSumiOpenedEditorView;

  constructor(app: OpenSumiApp) {
    super(app, 'Source Control');
  }

  get fileTreeView() {
    return this._fileTreeView;
  }

  get openedEditorView() {
    return this._openedEditorView;
  }

  async getFileStatTreeNodeByPath(path: string) {
    const treeItems = await (await this.fileTreeView.getViewElement())?.$$('[class*="scm_tree_node___"]');
    if (!treeItems) {
      return;
    }
    let node;
    for (const item of treeItems) {
      const desc = await item.$('[class*="scm_tree_node_description__"]');
      const title = await desc?.textContent();
      if (title?.endsWith(path)) {
        node = item;
        break;
      }
    }
    if (node) {
      return new OpenSumiSCMFileStatNode(node, this.app);
    }
  }
}
