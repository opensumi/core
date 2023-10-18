import { Tree } from '../../../src/recycle-tree/tree/Tree';
import { TreeNode, CompositeTreeNode } from '../../../src/recycle-tree/tree/TreeNode';
import { TreeNodeEvent, MetadataChangeType, WatchEvent } from '../../../src/recycle-tree/types';

describe('Tree', () => {
  class TreeA extends Tree {
    private _child: (Folder | File)[] = [];

    setPresetChildren(child: (Folder | File)[]) {
      this._child = child;
    }

    async resolveChildren() {
      if (this._child) {
        const child = this._child;
        this._child = [];
        return child;
      }
      return [];
    }
  }
  class Root extends CompositeTreeNode {
    get expanded() {
      return true;
    }
  }
  class Folder extends CompositeTreeNode {}
  class File extends TreeNode {
    constructor(tree: TreeA, parent: Folder | Root, metadata: { [key: string]: string }) {
      super(tree, parent, undefined, metadata);
    }
  }

  let tree: TreeA;
  let root: Root;

  beforeAll(() => {
    tree = new TreeA();
    root = new Root(tree, undefined, undefined);
  });

  test('create CompositeTreeNode or TreeNode', () => {
    expect(root.name.startsWith('root_')).toBeTruthy();
    let metadata = { name: 'folder' };
    const folder = new Folder(tree, root, undefined, metadata);
    expect(folder.name).toBe(metadata.name);
    expect(folder.parent).toEqual(root);
    metadata = { name: 'file' };
    const file = new File(tree, folder, metadata);
    expect(file.name).toBe(metadata.name);
  });

  it('change name should be work', () => {
    const metadata = { name: 'folder' };
    const folder = new Folder(tree, root, undefined, metadata);
    expect(folder.name).toBe(metadata.name);
    folder.name = 'folder_1';
    expect(folder.name).toBe('folder_1');
    const file = new File(tree, folder, metadata);
    file.name = 'file_1';
    expect(file.name).toBe('file_1');
  });

  it("add new key to Folder's metadata", (done) => {
    const root = new Root(tree, undefined, undefined);
    const metadata = { name: 'folder' };
    const folder = new Folder(tree, root, undefined, metadata);
    expect(folder.name).toBe(metadata.name);
    root.watcher.on(TreeNodeEvent.DidChangeMetadata, (node, { type, key }) => {
      if (type === MetadataChangeType.Added && key === 'other') {
        done();
      }
    });
    folder.addMetadata('other', 'hello');
  });

  it("add new key to File's metadata", (done) => {
    const root = new Root(tree, undefined, undefined);
    const metadata = { name: 'folder' };
    const folder = new Folder(tree, root, undefined, metadata);
    expect(folder.name).toBe(metadata.name);
    root.watcher.on(TreeNodeEvent.DidChangeMetadata, (node, { type, key }) => {
      if (type === MetadataChangeType.Added && key === 'other') {
        done();
      }
    });
    folder.addMetadata('other', 'hello');
  });

  it('ensure root was loaded', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    expect(root.branchSize).toBe(2);
  });

  it('force reload root', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    expect(root.branchSize).toBe(2);
    tree.setPresetChildren([
      new Folder(tree, root, undefined, { name: 'a' }),
      new File(tree, root, { name: 'b' }),
      new File(tree, root, { name: 'c' }),
    ]);
    await root.refresh();
    expect(root.branchSize).toBe(3);
  });

  it('expand all node and then collapse all', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    tree.setPresetChildren([
      new Folder(tree, root, undefined, { name: 'c' }),
      new File(tree, root, { name: 'd' }),
      new File(tree, root, { name: 'e' }),
    ]);
    await root.expandedAll();
    expect(root.branchSize).toBe(5);
    await root.collapsedAll();
    expect(root.branchSize).toBe(2);
  });

  it('mv b file to a folder', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    const a = root.getTreeNodeAtIndex(0);
    const b = root.getTreeNodeAtIndex(1);
    (b as TreeNode).mv(a as CompositeTreeNode);
    expect((b as TreeNode).parent).toEqual(a);
  });

  it('insert new item c to a folder', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    expect(root.branchSize).toBe(2);
    const a = root.getTreeNodeAtIndex(0);
    const c = new File(tree, root, { name: 'c' });
    (a as CompositeTreeNode).insertItem(c);
    expect((c as TreeNode).parent).toEqual(a);
    expect(root.branchSize).toBe(3);
  });

  it('unlink b file from root', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    expect(root.branchSize).toBe(2);
    const b = root.getTreeNodeAtIndex(1);
    (root as CompositeTreeNode).unlinkItem(b as TreeNode);
    expect(root.branchSize).toBe(1);
  });

  it("get node's id at index [0]", async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    expect(root.branchSize).toBe(2);
    const b = root.getTreeNodeAtIndex(1);
    expect(root.getIndexAtTreeNodeId(b!.id) > 0).toBeTruthy();
  });

  it('load nodes while path did not expanded', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    tree.setPresetChildren([
      new Folder(tree, root, undefined, { name: 'c' }),
      new File(tree, root, { name: 'd' }),
      new File(tree, root, { name: 'e' }),
    ]);
    expect(root.branchSize).toBe(2);
    const node = await root.loadTreeNodeByPath('a/c');
    expect((node as TreeNode).name).toBe('c');
    expect(root.branchSize).toBe(5);
  });

  it('dispath event should be work', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    const a = root.getTreeNodeAtIndex(0);
    const rootWatcher = root?.watchEvents.get(root.path);
    // mv node
    await rootWatcher?.callback({
      type: WatchEvent.Moved,
      oldPath: (a as TreeNode).path,
      newPath: (a as TreeNode).path.replace('a', 'c'),
    });
    expect((a as TreeNode).name).toBe('c');
    // remove node
    expect(root.branchSize).toBe(2);
    await rootWatcher?.callback({ type: WatchEvent.Removed, path: (a as TreeNode).path });
    expect(root.branchSize).toBe(1);
    tree.setPresetChildren([
      new Folder(tree, root, undefined, { name: 'c' }),
      new File(tree, root, { name: 'd' }),
      new File(tree, root, { name: 'e' }),
    ]);
    // reload nodes
    await root.refresh();
    expect(root.branchSize).toBe(3);
  });

  it('move/remove/add node should be work', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), new File(tree, root, { name: 'b' })]);
    await root.ensureLoaded();
    const a = root.getTreeNodeAtIndex(0);
    // move node
    root.moveNode((a as TreeNode).path, (a as TreeNode).path.replace('a', 'c'));
    expect((a as TreeNode).name).toBe('c');
    // remove node
    expect(root.branchSize).toBe(2);
    root.removeNode((a as TreeNode).path);
    expect(root.branchSize).toBe(1);
    // add node
    const d = new File(tree, root, { name: 'd' });
    root.addNode(d);
    expect(root.branchSize).toBe(2);
  });

  test('should remove the node from TreeNode.idToTreeNode and TreeNode.pathToTreeNode after the node is disposed.', () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    root.dispose();
    expect(TreeNode.idToTreeNode.has(root.id)).not.toBeTruthy();
    expect(TreeNode.pathToTreeNode.has(root.path)).not.toBeTruthy();
  });

  test('should remove the node from TreeNode.idToTreeNode and TreeNode.pathToTreeNode after the node is removed.', async () => {
    const tree = new TreeA();
    const root = new Root(tree, undefined, undefined);
    const b = new File(tree, root, { name: 'b' });
    tree.setPresetChildren([new Folder(tree, root, undefined, { name: 'a' }), b]);
    await root.ensureLoaded();

    root.unlinkItem(b);

    expect(TreeNode.idToTreeNode.has(b.id)).not.toBeTruthy();
    expect(TreeNode.pathToTreeNode.has(b.path)).not.toBeTruthy();
  });

  test('should refresh the node from TreeNode.idToTreeNode and TreeNode.pathToTreeNode after the node is refreshed.', async () => {
    const preA = new Folder(tree, root, undefined, { name: 'a' });
    const preB = new File(tree, root, { name: 'b' });
    tree.setPresetChildren([preA, preB]);
    await root.ensureLoaded();
    const a = new Folder(tree, root, undefined, { name: 'a' });
    const b = new File(tree, root, { name: 'b' });
    tree.setPresetChildren([a, b]);
    await root.refresh();

    expect(TreeNode.idToTreeNode).toContainEqual([a.id, a]);
    expect(TreeNode.idToTreeNode).toContainEqual([b.id, b]);
    expect(TreeNode.pathToTreeNode).toContainEqual([a.path, a]);
    expect(TreeNode.pathToTreeNode).toContainEqual([b.path, b]);

    expect(TreeNode.idToTreeNode).not.toContainEqual([preA.id, preA]);
    expect(TreeNode.idToTreeNode).not.toContainEqual([preB.id, preB]);
    expect(TreeNode.pathToTreeNode).not.toContainEqual([preA.path, preA]);
    expect(TreeNode.pathToTreeNode).not.toContainEqual([preB.path, preB]);

    // same path node should have the same id
    expect(preA.id).toEqual(a.id);
    expect(preB.id).toEqual(b.id);
  });
});
