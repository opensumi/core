/**
 * 对于 tree-like 的结构，希望父节点被删除/更新时，能影响到子节点
 */
export class FileTreeNode {
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

  constructor(public readonly path: string, public readonly parent?: FileTreeNode, private separator: string = '/') {
    if (parent) {
      this.key = parent.key + this.separator + path;
    } else {
      this.key = path;
    }
  }

  public bindOnDispose(callback: () => void) {
    this._onDisposed = callback;
  }

  addChild(path: string): FileTreeNode {
    const node = new FileTreeNode(path, this, this.separator);
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
  private separator: string;
  constructor(isWindows: boolean = false) {
    this.separator = isWindows ? '\\' : '/';
  }

  private nodes: Map<string, FileTreeNode> = new Map();

  add<T>(path: string) {
    const segments = path.split(this.separator);
    let p: string | undefined;
    let currentNode: FileTreeNode | undefined;
    for (const seg of segments) {
      if (p === undefined) {
        p = seg;
      }  else {
        p += this.separator + seg;
      }
      let node: FileTreeNode;
      if (this.nodes.has(p)) {
        node = this.nodes.get(p)!;
      } else {
        if (currentNode) {
          node = currentNode!.addChild(seg);
        } else {
          node = new FileTreeNode(seg, undefined, this.separator);
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
