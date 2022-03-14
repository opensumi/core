import { IDisposable, DisposableCollection } from '../../../utils';
import { TreeNodeEvent, ITreeNodeOrCompositeTreeNode } from '../../types';
import { TreeNode, CompositeTreeNode } from '../TreeNode';

import { CompositeDecoration, CompositeDecorationType, ClasslistComposite } from './CompositeDecoration';
import { Decoration, IDecorationTargetChangeEventData } from './Decoration';

interface IDecorationMeta {
  /**
   * 所有应用于自身的装饰器属性， 同时继承父级继承的装饰器
   */
  applicable: CompositeDecoration;

  /**
   * 所有可应用于子级的装饰器属性（一直继承，除非在继承过程中使用negated方法取消继承）
   */
  inheritable?: CompositeDecoration;
}

export class DecorationsManager implements IDisposable {
  private decorations: Map<Decoration, IDisposable> = new Map();
  private decorationsMeta: WeakMap<ITreeNodeOrCompositeTreeNode, IDecorationMeta> = new WeakMap();
  private disposables: DisposableCollection = new DisposableCollection();
  private disposed = false;

  constructor(root: CompositeTreeNode) {
    this.decorationsMeta.set(root, {
      applicable: new CompositeDecoration(root, CompositeDecorationType.Applicable),
      inheritable: new CompositeDecoration(root, CompositeDecorationType.Inheritable),
    });
    this.disposables.push(root.watcher.on(TreeNodeEvent.DidChangeParent, this.switchParent));
    this.disposables.push(root.watcher.on(TreeNodeEvent.DidDispose, this.decorationsMeta.delete));
  }

  public dispose(): void {
    for (const [decoration] of this.decorations) {
      this.removeDecoration(decoration);
    }
    this.disposables.dispose();
    this.disposed = true;
  }

  public addDecoration(decoration: Decoration): void {
    if (this.disposed) {
      throw new Error('DecorationManager disposed');
    }

    if (this.decorations.has(decoration)) {
      return;
    }

    const disposable = new DisposableCollection();

    disposable.push(decoration.onDidAddTarget(this.targetDecoration));
    disposable.push(decoration.onDidRemoveTarget(this.unTargetDecoration));
    disposable.push(decoration.onDidNegateTarget(this.negateDecoration));
    disposable.push(decoration.onDidUnNegateTarget(this.unNegateDecoration));

    this.decorations.set(decoration, disposable);

    for (const [target] of decoration.appliedTargets) {
      this.targetDecoration({ decoration, target });
    }

    for (const [target] of decoration.negatedTargets) {
      this.negateDecoration({ decoration, target });
    }
  }

  public removeDecoration(decoration: Decoration): void {
    const decorationSubscriptions = this.decorations.get(decoration);

    if (!decorationSubscriptions) {
      return;
    }

    for (const [target] of decoration.appliedTargets) {
      const meta = this.decorationsMeta.get(target);
      if (meta) {
        meta.applicable.remove(decoration);

        if (meta.inheritable) {
          meta.inheritable.remove(decoration);
        }
      }
    }

    for (const [target] of decoration.negatedTargets) {
      const meta = this.decorationsMeta.get(target);
      if (meta) {
        meta.applicable.unNegate(decoration);

        if (meta.inheritable) {
          meta.inheritable.unNegate(decoration);
        }
      }
    }

    decorationSubscriptions.dispose();
    this.decorations.delete(decoration);
  }

  public getDecorations(item: ITreeNodeOrCompositeTreeNode): ClasslistComposite | undefined {
    if (!item || !TreeNode.is(item)) {
      return;
    }
    const decMeta = this.getDecorationData(item);
    if (decMeta) {
      return decMeta.applicable.compositeCssClasslist;
    }
    return;
  }

  public getDecorationData(item: ITreeNodeOrCompositeTreeNode): IDecorationMeta | undefined {
    if (this.disposed) {
      return;
    }
    const meta = this.decorationsMeta.get(item);
    if (meta) {
      return meta;
    }
    // 执行到这里说明该节点不是直接节点，而是需要从父级节点继承装饰器属性
    if (!item || !item.parent) {
      return;
    }
    const parentMeta = this.getDecorationData(item.parent as CompositeTreeNode);
    if (parentMeta) {
      const ownMeta: IDecorationMeta = {
        applicable: new CompositeDecoration(item, CompositeDecorationType.Applicable, parentMeta.inheritable),
        inheritable: CompositeTreeNode.is(item)
          ? new CompositeDecoration(item, CompositeDecorationType.Inheritable, parentMeta.inheritable)
          : undefined,
      };
      this.decorationsMeta.set(item, ownMeta);
      return ownMeta;
    }
    return;
  }

  private targetDecoration = (event: IDecorationTargetChangeEventData): void => {
    const { decoration, target } = event;
    const decorationData = this.getDecorationData(target);
    if (decorationData) {
      const { applicable, inheritable } = decorationData;

      applicable.add(decoration);

      if (inheritable) {
        inheritable.add(decoration);
      }
    }
  };

  private unTargetDecoration = (event: IDecorationTargetChangeEventData): void => {
    const { decoration, target } = event;
    const decorationData = this.getDecorationData(target);
    if (decorationData) {
      const { applicable, inheritable } = decorationData;

      applicable.remove(decoration);

      if (inheritable) {
        inheritable.remove(decoration);
      }
    }
  };

  private negateDecoration = (event: IDecorationTargetChangeEventData): void => {
    const { decoration, target } = event;
    const decorationData = this.getDecorationData(target);
    if (decorationData) {
      const { applicable, inheritable } = decorationData;

      applicable.negate(decoration);

      if (inheritable) {
        inheritable.negate(decoration);
      }
    }
  };

  private unNegateDecoration = (event: IDecorationTargetChangeEventData): void => {
    const { decoration, target } = event;
    const decorationData = this.getDecorationData(target);
    if (decorationData) {
      const { applicable, inheritable } = decorationData;

      applicable.unNegate(decoration);

      if (inheritable) {
        inheritable.unNegate(decoration);
      }
    }
  };

  private switchParent = (
    target: ITreeNodeOrCompositeTreeNode,
    prevParent: CompositeTreeNode,
    newParent: CompositeTreeNode,
  ): void => {
    const ownMeta = this.decorationsMeta.get(target);
    if (!ownMeta) {
      return;
    }
    const newParentMeta = this.getDecorationData(newParent);
    if (newParentMeta) {
      ownMeta.applicable.changeParent(newParentMeta.inheritable);
      if (ownMeta.inheritable) {
        ownMeta.inheritable.changeParent(newParentMeta.inheritable);
      }
    }
  };
}
