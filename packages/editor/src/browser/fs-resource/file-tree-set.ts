import { isElectronRenderer, isWindows } from '@ali/ide-core-common';

function isNodeWindow() {
  // TODO 更好的判断 node 是否 windows（虽然一般除了electron不会把windows当服务器吧?)
  return isElectronRenderer() && isWindows;
}

/**
 * 对于 tree-like 的结构，希望父节点被删除/更新时，能影响到子节点
 * FIXME: 这边前后端环境不一致的时候还是有坑，应该使用 uri
 * TODO: 写点测试
 */
export class FileTreeNode {

  static separator: string = isNodeWindow() ? '\\' : '/';

  public readonly key: string;

  private _children: Map<string, FileTreeNode> | undefined;

  private _disposed: boolean = false;

  private _onDisposed: () => void;

  private get children() {
    if (!this._children) {
      this._children = new Map();
    }
    return this._children!;
  }

  constructor(public readonly path: string, public readonly parent?: FileTreeNode) {
    if (parent) {
      this.key = parent.key + FileTreeNode.separator + path;
    } else {
      this.key = path;
    }
  }

  public bindOnDispose(callback: () => void) {
    this._onDisposed = callback;
  }

  addChild(path: string): FileTreeNode {
    const node = new FileTreeNode(path, this);
    this.children.set(path, node);
    return node;
  }

  getAllDescendants(): FileTreeNode[] {
    if (!this._children) {
      return [this];
    } else {
      const result: FileTreeNode[]  = [this];
      this.children.forEach((c) => {
        result.push(...c.getAllDescendants());
      });
      return result;
    }
  }

  dispose() {
    if (this._disposed) {
      return;
    }
    if (this.parent) {
      this.parent.children.delete(this.path);
      if (this.parent.children.size === 0) {
        this.parent.dispose();
      }
    }
    if (this._onDisposed) {
      this._onDisposed();
    }
    this._disposed = true;
  }

}

export class FileTreeSet<T = any> {

  private nodes: Map<string, FileTreeNode> = new Map();

  add<T>(path: string) {
    const segments = path.split(FileTreeNode.separator);
    let p: string | undefined;
    let currentNode: FileTreeNode | undefined;
    for (const seg of segments) {
      if (p === undefined) {
        p = seg;
      }  else {
        p += FileTreeNode.separator + seg;
      }
      let node: FileTreeNode;
      if (this.nodes.has(p)) {
        node = this.nodes.get(p)!;
      } else {
        if (currentNode) {
          node = currentNode!.addChild(seg);
        } else {
          node = new FileTreeNode(seg);
        }
        node.bindOnDispose(() => {
          this.nodes.delete(node.key);
        });
        this.nodes.set(node.key, node);
      }
      currentNode = node;
    }
  }

  /**
   * 返回所有被影响的子节点
   * @param path
   */
  delete(path: string): string[] {
    const effected = this.effects(path);
    effected.forEach((e) => {
      const node = this.nodes.get(e);
      if (node) {
        node.dispose();
      }
    });
    return effected;
  }

  effects(path: string): string[] {
    const target = this.nodes.get(path);
    if (!target) {
      return [];
    } else {
      return target!.getAllDescendants().map((n) => n.key);
    }
  }

}
