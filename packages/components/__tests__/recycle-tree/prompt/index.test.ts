import { TreeNodeType, PromptValidateMessage, PROMPT_VALIDATE_TYPE } from '../../../src';
import { NewPromptHandle, RenamePromptHandle } from '../../../src/recycle-tree/prompt';
import { Tree } from '../../../src/recycle-tree/tree/Tree';
import { TreeNode, CompositeTreeNode } from '../../../src/recycle-tree/tree/TreeNode';

describe('NewPromptHandle', () => {
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
  let prompt: NewPromptHandle;

  beforeAll(() => {
    tree = new TreeA();
    root = new Root(tree, undefined, undefined);
    prompt = new NewPromptHandle(TreeNodeType.TreeNode, root);
  });

  test('some property should exist', () => {
    expect(typeof prompt.id).toBeTruthy();
    expect(prompt.depth).toBe(root.depth + 1);

    expect(prompt.destroyed).toBeFalsy();
    expect(typeof prompt.onChange).toBe('function');
    expect(typeof prompt.onCommit).toBe('function');
    expect(typeof prompt.onCancel).toBe('function');
    expect(typeof prompt.onFocus).toBe('function');
    expect(typeof prompt.onBlur).toBe('function');
    expect(typeof prompt.onDestroy).toBe('function');
  });

  test('setSelectionRange', () => {
    const setSelectionRange = jest.fn();
    prompt.$.setSelectionRange = setSelectionRange;
    prompt.setSelectionRange(0, 5);
    expect(setSelectionRange).toBeCalledWith(0, 5);
  });

  test('addClassName', () => {
    const addClassName = jest.fn();
    prompt.$.classList.add = addClassName;
    prompt.addClassName('test');
    expect(addClassName).toBeCalledWith('test');
  });

  test('removeClassName', () => {
    const removeClassName = jest.fn();
    prompt.$.classList.remove = removeClassName;
    prompt.removeClassName('test');
    expect(removeClassName).toBeCalledWith('test');
  });

  test('addAddonAfter', () => {
    const appendChild = jest.fn();
    prompt.$addonAfter.appendChild = appendChild;
    prompt.addAddonAfter('test');
    expect(appendChild).toBeCalledTimes(1);
  });

  test('removeAddonAfter', () => {
    prompt.removeAddonAfter();
  });

  test('addValidateMessage', () => {
    const info: PromptValidateMessage = {
      message: 'info',
      type: PROMPT_VALIDATE_TYPE.INFO,
    };
    const error: PromptValidateMessage = {
      message: 'error',
      type: PROMPT_VALIDATE_TYPE.ERROR,
    };
    const warn: PromptValidateMessage = {
      message: 'warn',
      type: PROMPT_VALIDATE_TYPE.WARNING,
    };
    prompt.$.parentElement?.parentElement;

    prompt.addValidateMessage(info);
    expect(prompt.$validate.innerText).toBe(info.message);
    prompt.addValidateMessage(error);
    expect(prompt.$validate.innerText).toBe(error.message);
    prompt.addValidateMessage(warn);
    expect(prompt.$validate.innerText).toBe(warn.message);
  });

  test('removeValidateMessage', () => {
    prompt.removeValidateMessage();
    expect(prompt.$validate.parentElement).toBeNull();
  });

  test('dispatch event', () => {
    let event = new window.Event('click');
    prompt.$.dispatchEvent(event);
    event = new window.Event('keyup');
    prompt.$.dispatchEvent(event);
    event = new window.Event('focus');
    prompt.$.dispatchEvent(event);
    event = new window.Event('blur');
    prompt.$.dispatchEvent(event);
  });

  test('dispatch Escape event', (done) => {
    const event = new window.Event('keydown');
    event.initEvent('keydown', true, true);
    (event as any).key = 'Escape';
    prompt = new NewPromptHandle(TreeNodeType.TreeNode, root);
    prompt.$.dispatchEvent(event);
    setTimeout(() => {
      expect(prompt.destroyed).toBeTruthy();
      done();
    }, 100);
  });

  test('dispatch Enter event', (done) => {
    const event = new window.Event('keydown');
    event.initEvent('keydown', true, true);
    (event as any).key = 'Enter';
    prompt = new NewPromptHandle(TreeNodeType.TreeNode, root);
    prompt.$.dispatchEvent(event);
    setTimeout(() => {
      expect(prompt.destroyed).toBeTruthy();
      done();
    }, 100);
  });

  test('destroy', () => {
    prompt = new NewPromptHandle(TreeNodeType.TreeNode, root);
    prompt.destroy();
    expect(prompt.destroyed).toBeTruthy();
  });
});

describe('RenamePromptHandle', () => {
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
  let file: File;
  let prompt: RenamePromptHandle;

  beforeAll(() => {
    tree = new TreeA();
    root = new Root(tree, undefined, undefined);
    file = new File(tree, root, { name: 'a' });
    prompt = new RenamePromptHandle('a', file);
  });

  test('some property should exist', () => {
    expect(typeof prompt.id).toBeTruthy();
    expect(prompt.depth).toBe(file.depth);

    expect(prompt.destroyed).toBeFalsy();
    expect(typeof prompt.onChange).toBe('function');
    expect(typeof prompt.onCommit).toBe('function');
    expect(typeof prompt.onCancel).toBe('function');
    expect(typeof prompt.onFocus).toBe('function');
    expect(typeof prompt.onBlur).toBe('function');
    expect(typeof prompt.onDestroy).toBe('function');
  });
});
