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
      return this._child;
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

  it("add new key to Folder's metadata", async (done) => {
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

  it("add new key to File's metadata", async (done) => {
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
    const node = await root.forceLoadTreeNodeAtPath('a/c');
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
    // reload nodes
    await rootWatcher?.callback({ type: WatchEvent.Changed, path: root.path });
    expect(root.branchSize).toBe(2);
  });
});
