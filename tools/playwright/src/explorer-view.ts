import { OpenSumiApp } from './app';
import { OpenSumiFileTreeView } from './filetree-view';
import { OpenSumiPanel } from './panel';
import { OpenSumiTreeNode } from './tree-node';

export class OpenSumiExplorerFileStatNode extends OpenSumiTreeNode {
  async getFsPath() {
    return await this.elementHandle.getAttribute('title');
  }

  async isFolder() {
    const icon = await this.elementHandle.waitForSelector("[class*='file_icon___']");
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
      await this.elementHandle.dblclick();
    } else {
      await this.elementHandle.click();
    }
  }
}

export class OpenSumiExplorerView extends OpenSumiPanel {
  private _fileTreeView: OpenSumiFileTreeView;

  constructor(app: OpenSumiApp) {
    super(app, 'explorer');
  }

  initFileTreeView(name: string) {
    this._fileTreeView = new OpenSumiFileTreeView(this.app, name);
  }

  get fileTreeView() {
    return this._fileTreeView;
  }

  async getFileStatTreeNodeByPath(path: string) {
    const treeItems = await (await this.fileTreeView.getViewElement())?.$$('[class*="file_tree_node__"]');
    if (!treeItems) {
      return;
    }
    let node;
    for (const item of treeItems) {
      const title = await item.getAttribute('title');
      if (title?.includes(path)) {
        node = item;
        break;
      }
    }
    if (node) {
      return new OpenSumiExplorerFileStatNode(node, this.app);
    }
  }
}
