import { IDisposable, Disposable, Emitter } from '../../../utils';
import { ITreeNode, ICompositeTreeNode } from '../../types';
import { TreeNode } from '../TreeNode';

export enum TargetMatchMode {
  None = 1,
  // 样式作用于自身
  Self,
  // 样式作用于子元素
  Children,
  // 样式作用于自身及子元素
  SelfAndChildren,
}

export interface IDecorationEventData {
  decoration: Decoration;
  classname?: string;
}

export interface IDecorationTargetChangeEventData {
  decoration: Decoration;
  target: ITreeNode | ICompositeTreeNode;
}

export class Decoration {
  private _cssClassList: Set<string>;
  private _appliedTargets: Map<ITreeNode | ICompositeTreeNode, TargetMatchMode> = new Map();
  private _negatedTargets: Map<ITreeNode | ICompositeTreeNode, TargetMatchMode> = new Map();

  private _disabled = false;

  private appliedTargetsDisposables: WeakMap<ITreeNode | ICompositeTreeNode, IDisposable> = new WeakMap();
  private negatedTargetsDisposables: WeakMap<ITreeNode | ICompositeTreeNode, IDisposable> = new WeakMap();

  private onDidAddCSSClassnameEmitter: Emitter<IDecorationEventData> = new Emitter();
  private onDidRemoveCSSClassnameEmitter: Emitter<IDecorationEventData> = new Emitter();
  private onDidDisableDecorationEmitter: Emitter<IDecorationEventData> = new Emitter();
  private onDidEnableDecorationEmitter: Emitter<IDecorationEventData> = new Emitter();
  private onDidAddTargetEmitter: Emitter<IDecorationTargetChangeEventData> = new Emitter();
  private onDidRemoveTargetEmitter: Emitter<IDecorationTargetChangeEventData> = new Emitter();
  private onDidNegateTargetEmitter: Emitter<IDecorationTargetChangeEventData> = new Emitter();
  private onDidUnNegateTargetEmitter: Emitter<IDecorationTargetChangeEventData> = new Emitter();

  constructor(...cssClassList: string[]) {
    if (Array.isArray(cssClassList)) {
      if (cssClassList.every((classname) => typeof classname === 'string')) {
        this._cssClassList = new Set(cssClassList);
      } else {
        throw new TypeError('classlist must be of type `Array<string>`');
      }
    } else {
      this._cssClassList = new Set();
    }
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(disabled: boolean) {
    this._disabled = disabled;
    if (disabled) {
      this.onDidDisableDecorationEmitter.fire({ decoration: this });
    } else {
      this.onDidEnableDecorationEmitter.fire({ decoration: this });
    }
  }

  get appliedTargets() {
    return this._appliedTargets;
  }

  get negatedTargets() {
    return this._negatedTargets;
  }

  get cssClassList() {
    return this._cssClassList;
  }

  get onDidAddCSSClassname() {
    return this.onDidAddCSSClassnameEmitter.event;
  }

  get onDidRemoveCSSClassname() {
    return this.onDidRemoveCSSClassnameEmitter.event;
  }

  get onDidDisableDecoration() {
    return this.onDidDisableDecorationEmitter.event;
  }

  get onDidEnableDecoration() {
    return this.onDidEnableDecorationEmitter.event;
  }

  get onDidAddTarget() {
    return this.onDidAddTargetEmitter.event;
  }

  get onDidRemoveTarget() {
    return this.onDidRemoveTargetEmitter.event;
  }

  get onDidNegateTarget() {
    return this.onDidNegateTargetEmitter.event;
  }

  get onDidUnNegateTarget() {
    return this.onDidUnNegateTargetEmitter.event;
  }

  public addCSSClass(className: string): void {
    if (this._cssClassList.has(className)) {
      return;
    }
    this._cssClassList.add(className);
    this.onDidAddCSSClassnameEmitter.fire({ decoration: this, classname: className });
  }

  public removeCSSClass(className: string): void {
    if (!this._cssClassList.has(className)) {
      return;
    }
    this._cssClassList.delete(className);
    this.onDidRemoveCSSClassnameEmitter.fire({ decoration: this, classname: className });
  }

  /**
   * 判断当前装饰器是否包含指定的对象绑定
   * @param target
   */
  public hasTarget(target: ITreeNode | ICompositeTreeNode) {
    const existingFlags = this._appliedTargets.get(target);
    return !!existingFlags;
  }

  /**
   * 为当前装饰器绑定对象
   * @param target
   * @param flags
   */
  public addTarget(
    target: ITreeNode | ICompositeTreeNode,
    flags: TargetMatchMode = TargetMatchMode.Self,
  ): IDisposable | undefined {
    const existingFlags = this._appliedTargets.get(target);
    if (existingFlags === flags) {
      return;
    }
    if (!TreeNode.is(target)) {
      return;
    }
    this._appliedTargets.set(target, flags);
    const dispose = Disposable.create(() => {
      this.removeTarget(target);
    });
    this.appliedTargetsDisposables.set(target, dispose);
    this.onDidAddTargetEmitter.fire({ decoration: this, target });
    return dispose;
  }

  /**
   * 为当前装饰器移除对象绑定
   * @param target
   * @param flags
   */
  public removeTarget(target: ITreeNode | ICompositeTreeNode): void {
    if (this._appliedTargets.delete(target)) {
      const disposable = this.appliedTargetsDisposables.get(target);
      if (disposable) {
        disposable.dispose();
      }
      this.onDidRemoveTargetEmitter.fire({ decoration: this, target });
    }
  }

  /**
   * 否定装饰器绑定
   * negate 表示 :not修饰符
   * 定义节点不应用样式
   * @param target
   * @param flags
   */
  public negateTarget(
    target: ITreeNode | ICompositeTreeNode,
    flags: TargetMatchMode = TargetMatchMode.Self,
  ): IDisposable | undefined {
    const existingFlags = this._negatedTargets.get(target);
    if (existingFlags === flags) {
      return;
    }
    if (!TreeNode.is(target)) {
      return;
    }
    this._negatedTargets.set(target, flags);
    const dispose = Disposable.create(() => {
      this.unNegateTarget(target);
    });
    this.negatedTargetsDisposables.set(target, dispose);
    this.onDidNegateTargetEmitter.fire({ decoration: this, target });
    return dispose;
  }

  /**
   * 取消否定装饰器绑定
   * @param target
   */
  public unNegateTarget(target: ITreeNode | ICompositeTreeNode): void {
    if (this._negatedTargets.delete(target)) {
      const disposable = this.negatedTargetsDisposables.get(target);
      if (disposable) {
        disposable.dispose();
      }
      this.onDidUnNegateTargetEmitter.fire({ decoration: this, target });
    }
  }
}
