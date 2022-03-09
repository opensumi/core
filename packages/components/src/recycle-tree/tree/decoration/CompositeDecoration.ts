import { DisposableCollection } from '../../../utils';
import { ITreeNodeOrCompositeTreeNode } from '../../types';

import { Decoration, TargetMatchMode, IDecorationEventData } from './Decoration';

export class ClasslistComposite {
  public classlist: ReadonlyArray<string>;
  constructor(
    /**
     * 注册样式变化监听函数
     */
    public readonly addChangeListener: (namedCallback: () => void) => void,
    /**
     * 注销样式变化监听函数
     */
    public readonly removeChangeListener: (namedCallback: () => void) => void,
  ) {}
}

export enum CompositeDecorationType {
  Applicable = 1,
  Inheritable,
}

export enum ChangeReason {
  UnTargetDecoration = 1,
  TargetDecoration,
}

export class CompositeDecoration {
  public renderedDecorations: Map<Decoration, DisposableCollection>;
  public targetedDecorations: Set<Decoration>;
  public negatedDecorations: Set<Decoration>;

  public parent: CompositeDecoration;
  public compositeCssClasslist: ClasslistComposite;

  private target: ITreeNodeOrCompositeTreeNode;
  private type: CompositeDecorationType;
  private selfOwned: boolean;
  private linkedComposites: Set<CompositeDecoration>;
  private classlistChangeCallbacks: Set<() => void>;

  constructor(target: ITreeNodeOrCompositeTreeNode, type: CompositeDecorationType, parent?: CompositeDecoration) {
    this.target = target;
    this.type = type;
    this.linkedComposites = new Set();
    this.classlistChangeCallbacks = new Set();

    this.compositeCssClasslist = new ClasslistComposite(
      this.classlistChangeCallbacks.add.bind(this.classlistChangeCallbacks),
      this.classlistChangeCallbacks.delete.bind(this.classlistChangeCallbacks),
    );

    if (parent) {
      this.selfOwned = false;
      this.parent = parent;
      this.renderedDecorations = parent.renderedDecorations;
      this.compositeCssClasslist.classlist = parent.compositeCssClasslist.classlist;
      parent.linkedComposites.add(this);
    } else {
      this.renderedDecorations = new Map();
      this.targetedDecorations = new Set();
      this.negatedDecorations = new Set();
      this.compositeCssClasslist.classlist = [];
      this.selfOwned = true;
    }
  }

  public changeParent(newParent?: CompositeDecoration) {
    if (!newParent) {
      return;
    }
    if (!this.selfOwned) {
      return this.parentOwn(newParent);
    }

    // 清除所有除了匹配的装饰器属性
    for (const [decoration] of this.renderedDecorations) {
      this.recursiveRefresh(this, false, ChangeReason.UnTargetDecoration, decoration, false);
    }
    if (this.parent !== newParent) {
      this.parent.linkedComposites.delete(this);
      this.parent = newParent;
      newParent.linkedComposites.add(this);
    }

    // 然后添加所有除了不适用的继承装饰器
    for (const [decoration] of newParent.renderedDecorations) {
      this.recursiveRefresh(this, false, ChangeReason.TargetDecoration, decoration, false);
    }
  }

  public add(decoration: Decoration): void {
    const applicationMode = decoration.appliedTargets.get(this.target);

    const applicableToSelf =
      applicationMode &&
      (applicationMode === TargetMatchMode.Self || applicationMode === TargetMatchMode.SelfAndChildren);
    const applicableToChildren =
      applicationMode &&
      (applicationMode === TargetMatchMode.Children || applicationMode === TargetMatchMode.SelfAndChildren);

    if (this.type === CompositeDecorationType.Applicable && !applicableToSelf) {
      return;
    }
    if (this.type === CompositeDecorationType.Inheritable && !applicableToChildren) {
      return;
    }

    if (!this.selfOwned) {
      this.selfOwn(ChangeReason.TargetDecoration, decoration);
      this.targetedDecorations.add(decoration);
      return;
    }
    if (this.targetedDecorations.has(decoration)) {
      return;
    }
    this.targetedDecorations.add(decoration);
    this.recursiveRefresh(this, false, ChangeReason.TargetDecoration, decoration);
  }

  public remove(decoration: Decoration): void {
    if (!this.selfOwned) {
      return;
    }
    if (this.targetedDecorations.delete(decoration)) {
      if (this.negatedDecorations.size === 0 && this.targetedDecorations.size === 0 && this.parent) {
        return this.parentOwn(undefined, ChangeReason.UnTargetDecoration, decoration);
      }
      this.recursiveRefresh(this, false, ChangeReason.UnTargetDecoration, decoration);
    }
  }

  public negate(decoration: Decoration): void {
    const negationMode = decoration.negatedTargets.get(this.target);

    const negatedOnSelf =
      negationMode && (negationMode === TargetMatchMode.Self || negationMode === TargetMatchMode.SelfAndChildren);
    const negatedOnChildren =
      negationMode && (negationMode === TargetMatchMode.Children || negationMode === TargetMatchMode.SelfAndChildren);

    if (this.type === CompositeDecorationType.Applicable && !negatedOnSelf) {
      return;
    }
    if (this.type === CompositeDecorationType.Inheritable && !negatedOnChildren) {
      return;
    }

    if (!this.selfOwned) {
      this.selfOwn(ChangeReason.UnTargetDecoration, decoration);
      this.negatedDecorations.add(decoration);
      return;
    }
    if (this.negatedDecorations.has(decoration)) {
      return;
    }
    this.negatedDecorations.add(decoration);
    if (this.renderedDecorations.has(decoration)) {
      this.removeDecorationClasslist(decoration);
    }
  }

  public unNegate(decoration: Decoration): void {
    if (!this.selfOwned) {
      return;
    }
    if (this.negatedDecorations.delete(decoration)) {
      if (this.negatedDecorations.size === 0 && this.targetedDecorations.size === 0 && this.parent) {
        return this.parentOwn();
      }
      // 当前非父节点并且其父节点和其本身均不含有该装饰器
      if (
        !this.renderedDecorations.has(decoration) &&
        (this.parent.renderedDecorations.has(decoration) || decoration.appliedTargets.has(this.target))
      ) {
        this.recursiveRefresh(this, false, ChangeReason.TargetDecoration, decoration);
      }
    }
  }

  private selfOwn(reason: ChangeReason, decoration: Decoration) {
    if (this.selfOwned) {
      throw new Error('CompositeDecoration is already self owned');
    }
    const parent = this.parent;
    this.selfOwned = true;
    this.compositeCssClasslist.classlist = [];
    this.renderedDecorations = new Map();
    this.targetedDecorations = new Set();
    this.negatedDecorations = new Set();

    // 首先处理所有继承的装饰器
    for (const [inheritedDecoration] of parent.renderedDecorations) {
      if (inheritedDecoration !== decoration) {
        this.processCompositeAlteration(ChangeReason.TargetDecoration, inheritedDecoration);
      }
    }

    // 当触发的为:not类型装饰器变化
    if (
      reason === ChangeReason.UnTargetDecoration &&
      // 父节点装饰器拥有此装饰器
      this.parent.renderedDecorations.has(decoration) &&
      // 本身不包含此装饰器
      !this.renderedDecorations.has(decoration)
    ) {
      // 通知ClassList变化
      this.notifyClasslistChange(false);
    }

    this.recursiveRefresh(this, true, reason, decoration);
  }

  private parentOwn(newParent?: CompositeDecoration, reason?: ChangeReason, decoration?: Decoration) {
    this.selfOwned = false;
    this.targetedDecorations && this.targetedDecorations.clear();
    this.negatedDecorations && this.negatedDecorations.clear();
    if (newParent && this.parent !== newParent) {
      if (this.parent) {
        this.parent.linkedComposites.delete(this);
      }
      newParent.linkedComposites.add(this);
      this.parent = newParent;
    }

    this.recursiveRefresh(this, true, reason, decoration);
  }

  private processCompositeAlteration(reason: ChangeReason, decoration: Decoration): boolean {
    if (!this.selfOwned) {
      throw new Error('CompositeDecoration is not self owned');
    }
    if (reason === ChangeReason.UnTargetDecoration) {
      const disposable = this.renderedDecorations.get(decoration);
      if (disposable) {
        const applicationMode = decoration.appliedTargets.get(this.target);

        const applicableToSelf =
          applicationMode &&
          (applicationMode === TargetMatchMode.Self || applicationMode === TargetMatchMode.SelfAndChildren);
        const applicableToChildren =
          applicationMode &&
          (applicationMode === TargetMatchMode.Children || applicationMode === TargetMatchMode.SelfAndChildren);

        if (applicableToSelf && this.type === CompositeDecorationType.Applicable) {
          return false;
        }

        if (applicableToChildren && this.type === CompositeDecorationType.Inheritable) {
          return false;
        }

        this.removeDecorationClasslist(decoration, false);

        if (disposable) {
          disposable.dispose();
        }
        return this.renderedDecorations.delete(decoration);
      }
      return false;
    }

    if (reason === ChangeReason.TargetDecoration) {
      const negationMode = decoration.negatedTargets.get(this.target);

      const negatedOnSelf =
        negationMode && (negationMode === TargetMatchMode.Self || negationMode === TargetMatchMode.SelfAndChildren);
      const negatedOnChildren =
        negationMode && (negationMode === TargetMatchMode.Children || negationMode === TargetMatchMode.SelfAndChildren);

      if (negatedOnSelf && this.type === CompositeDecorationType.Applicable) {
        return false;
      }

      if (negatedOnChildren && this.type === CompositeDecorationType.Inheritable) {
        return false;
      }

      if (!this.renderedDecorations.has(decoration)) {
        const disposables = new DisposableCollection();

        disposables.push(decoration.onDidAddCSSClassname(this.handleDecorationDidAddClassname));
        disposables.push(decoration.onDidRemoveCSSClassname(this.handleDecorationDidRemoveClassname));
        disposables.push(decoration.onDidDisableDecoration(this.handleDecorationDisable));
        disposables.push(decoration.onDidEnableDecoration(this.mergeDecorationClasslist));
        this.renderedDecorations.set(decoration, disposables);
        if (!decoration.disabled) {
          (this.compositeCssClasslist.classlist as string[]).push(...decoration.cssClassList);
          return true;
        }
        return false;
      }
    }
    return false;
  }

  private recursiveRefresh(
    origin: CompositeDecoration,
    updateReferences: boolean,
    reason?: ChangeReason,
    decoration?: Decoration,
    notifyListeners = true,
  ) {
    // 更改当前manager引用的renderedDecorations及compositeCssClasslist.classlist
    if (!this.selfOwned && updateReferences) {
      this.renderedDecorations = this.parent.renderedDecorations;
      this.compositeCssClasslist.classlist = this.parent.compositeCssClasslist.classlist;
    }

    if (this.selfOwned && updateReferences && origin !== this) {
      // 清理所有装饰器逻辑
      for (const [renderedDecoration] of this.renderedDecorations) {
        this.processCompositeAlteration(ChangeReason.UnTargetDecoration, renderedDecoration);
      }

      // 添加继承的装饰器逻辑
      for (const [inheritedDecoration] of this.parent.renderedDecorations) {
        this.processCompositeAlteration(ChangeReason.TargetDecoration, inheritedDecoration);
      }

      if (notifyListeners) {
        this.notifyClasslistChange(false);
      }
    } else if (
      this.selfOwned &&
      reason === ChangeReason.UnTargetDecoration &&
      decoration &&
      this.renderedDecorations.has(decoration)
    ) {
      this.processCompositeAlteration(reason, decoration);
      if (notifyListeners) {
        this.notifyClasslistChange(false);
      }
    } else if (
      this.selfOwned &&
      reason === ChangeReason.TargetDecoration &&
      decoration &&
      this.processCompositeAlteration(reason, decoration) &&
      notifyListeners
    ) {
      this.notifyClasslistChange(false);
    } else if (!this.selfOwned && notifyListeners) {
      this.notifyClasslistChange(false);
    }

    for (const linkedComposite of this.linkedComposites) {
      linkedComposite.recursiveRefresh(origin, updateReferences, reason, decoration, notifyListeners);
    }
  }

  private handleDecorationDidAddClassname = (event: IDecorationEventData) => {
    const { classname } = event;

    if (!this.selfOwned || !classname) {
      return;
    }
    (this.compositeCssClasslist.classlist as string[]).push(classname);
    this.notifyClasslistChange();
  };

  private handleDecorationDidRemoveClassname = (event: IDecorationEventData) => {
    const { classname } = event;
    if (!this.selfOwned || !classname) {
      return;
    }
    const idx = this.compositeCssClasslist.classlist.indexOf(classname);
    if (idx > -1) {
      (this.compositeCssClasslist.classlist as string[]).splice(idx, 1);
      this.notifyClasslistChange();
    }
  };

  private mergeDecorationClasslist = (event: IDecorationEventData) => {
    const { decoration } = event;
    if (!this.selfOwned) {
      return;
    }
    (this.compositeCssClasslist.classlist as string[]).push(...decoration.cssClassList);
    this.notifyClasslistChange();
  };

  private handleDecorationDisable = (event: IDecorationEventData) => {
    const { decoration } = event;
    this.removeDecorationClasslist(decoration);
  };
  private removeDecorationClasslist(decoration: Decoration, notifyAll = true) {
    if (!this.selfOwned) {
      return;
    }
    for (const classname of decoration.cssClassList) {
      const idx = this.compositeCssClasslist.classlist.indexOf(classname);
      if (idx > -1) {
        (this.compositeCssClasslist.classlist as string[]).splice(idx, 1);
      }
    }
    if (notifyAll) {
      this.notifyClasslistChange();
    }
  }

  private notifyClasslistChange(recursive = true) {
    for (const cb of [...this.classlistChangeCallbacks]) {
      cb();
    }
    if (recursive) {
      for (const linkedComposite of this.linkedComposites) {
        if (!linkedComposite.selfOwned) {
          linkedComposite.notifyClasslistChange();
        }
      }
    }
  }
}
