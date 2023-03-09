import { OpenSumiApp } from './app';
import { OpenSumiOpenedEditorView } from './opened-editor-view';
import { OpenSumiPanel } from './panel';
import { OpenSumiSourceControlView } from './source-control-view';
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

  async getNodeTail() {
    const tail = await this.elementHandle.$('[class*="scm_tree_node_tail___"]');
    return await tail?.textContent();
  }
}

export class OpenSumiSCMView extends OpenSumiPanel {
  private _scmView: OpenSumiSourceControlView;
  private _openedEditorView: OpenSumiOpenedEditorView;

  constructor(app: OpenSumiApp) {
    super(app, 'SCM');
    this._scmView = new OpenSumiSourceControlView(app, 'SOURCE CONTROL');
  }

  get scmView() {
    return this._scmView;
  }

  get openedEditorView() {
    return this._openedEditorView;
  }

  async getTreeItems() {
    const treeItems = await (await this.scmView.getViewElement())?.$$('[class*="scm_tree_node___"]');
    const node: OpenSumiSCMFileStatNode[] = [];

    if (treeItems) {
      for (const item of treeItems) {
        node.push(new OpenSumiSCMFileStatNode(item, this.app));
      }
    }

    return node;
  }

  async getFileStatTreeNodeByPath(path: string) {
    const treeItems = await (await this.scmView.getViewElement())?.$$('[class*="scm_tree_node___"]');
    if (!treeItems) {
      return;
    }
    let node;
    for (const item of treeItems) {
      const title = await item.getAttribute('title');
      // title maybe `a.js • Untracked`
      if (title?.split(' ')[0]?.endsWith(path)) {
        node = item;
        break;
      }
    }
    if (node) {
      return new OpenSumiSCMFileStatNode(node, this.app);
    }
  }
}
