import { Injectable } from '@ali/common-di';
import { IDisposable } from '@ali/ide-core-common';
import { IContextKeyServiceTarget, IContextKey, Context, IContext, IContextKeyService, ContextKeyExpr} from './context-key';

// 往Element上存储contextid使用的属性
const KEYBINDING_CONTEXT_ATTR = 'data-keybinding-context';

/**
 * 用于查找当前节点上或父节点上的contextid
 * 用于实现局部Context的获取
 * @param domNode
 */
const findContextAttr = (domNode: IContextKeyServiceTarget | null): number => {
  while (domNode) {
    if (domNode.hasAttribute(KEYBINDING_CONTEXT_ATTR)) {
      const attr = domNode.getAttribute(KEYBINDING_CONTEXT_ATTR);
      if (attr) {
        return parseInt(attr, 10);
      }
      return NaN;
    }
    domNode = domNode.parentElement;
  }
  return 0;
};

/**
 * 空Context类
 */
class NullContext extends Context {

  static readonly INSTANCE = new NullContext();

  constructor() {
    super(-1, null);
  }

  public setValue(key: string, value: any): boolean {
    return false;
  }

  public removeValue(key: string): boolean {
    return false;
  }

  public getValue<T>(key: string): T | undefined {
    return undefined;
  }

  collectAllValues(): { [key: string]: any; } {
    return Object.create(null);
  }
}

/**
 * 包含全局配置的Context
 * 用于: 1. when机制中存取context 2. 全局配置存取
 */
class ConfigAwareContextValuesContainer extends Context {

  private static _keyPrefix = 'config.';
  private readonly _values = new Map<string, any>();
  private readonly _listener: IDisposable;

  constructor(id: number) {
    super(id, null);
  }

  dispose(): void {
    this._listener.dispose();
  }

  getValue(key: string): any {

    if (key.indexOf(ConfigAwareContextValuesContainer._keyPrefix) !== 0) {
      return super.getValue(key);
    }
    // TODO: 有全局配置前缀的另外处理
  }

  setValue(key: string, value: any): boolean {
    return super.setValue(key, value);
  }

  removeValue(key: string): boolean {
    return super.removeValue(key);
  }

  collectAllValues(): { [key: string]: any; } {
    const result: { [key: string]: any } = Object.create(null);
    this._values.forEach((value, index) => result[index] = value);
    return { ...result, ...super.collectAllValues() };
  }
}

/**
 * 全局上下文变量值
 */
export class ContextKey<T> implements IContextKey<T> {
  private _service: AbstractContextKeyService;
  private _key: string;
  private _defaultValue: T | undefined;

  constructor(service: AbstractContextKeyService, key: string, defaultValue?: T | undefined) {
    this._service = service;
    this._key = key;
    this._defaultValue = defaultValue;
    this.reset();
  }

  public set(value: T): void {
    this._service.setContext(this._key, value);
  }

  public reset(): void {
    if (typeof this._defaultValue === 'undefined') {
      this._service.removeContext(this._key);
    } else {
      this._service.setContext(this._key, this._defaultValue);
    }
  }

  public get(): T | undefined {
    return this._service.getContextKeyValue<T>(this._key);
  }

}

/**
 * ContextKeyService 抽象类实现，主要定义当前的 ContextID 及管理 Context
 */
export abstract class AbstractContextKeyService implements IContextKeyService {

  protected _isDisposed: boolean;
  protected _contextId: number;

  abstract dispose(): void;

  constructor(id: number) {
    this._isDisposed = false;
    this._contextId = id;
  }

  public createKey<T>(key: string, defaultValue: T | undefined) {
    return new ContextKey(this, key, defaultValue);
  }

  public setContext(key: string, value: any): void {
    if (this._isDisposed) {
      return;
    }
    const context = this.getContextValuesContainer(this._contextId);
    if (!context) {
      return;
    }
    context.setValue(key, value);
  }

  public removeContext(key: string): void {
    if (this._isDisposed) {
      return;
    }
    this.getContextValuesContainer(this._contextId).removeValue(key);
  }

  public getContextKeyValue<T>(key: string): T | undefined {
    if (this._isDisposed) {
      return undefined;
    }
    return this.getContextValuesContainer(this._contextId).getValue<T>(key);
  }

  // 从Element上获取当前的ContextKey
  public getContext(target: IContextKeyServiceTarget | null): IContext {
    if (this._isDisposed) {
      return NullContext.INSTANCE;
    }
    return this.getContextValuesContainer(findContextAttr(target));
  }

  public abstract getContextValuesContainer(contextId: number): Context;
}

/**
 * ContextKeyServe实现类，提供获取Context及匹配表达式能力
 */
@Injectable()
export class ContextKeyService extends AbstractContextKeyService implements IContextKeyService {
  protected _contexts = new Map<number, Context>();

  constructor() {
    super(0);
    this._contexts.set(this._contextId, new ConfigAwareContextValuesContainer(this._contextId));
  }

  public getContextValuesContainer(_: number): Context {
    if (this._isDisposed) {
      return NullContext.INSTANCE;
    }
    return this._contexts.get(this._contextId) || NullContext.INSTANCE;
  }

  public match(expression: string, target?: IContextKeyServiceTarget): boolean {
    // TODO: 从IContextKeyServiceTarget中获取元素的Context，逐级向上查找
    const rules = ContextKeyExpr.deserialize(expression);
    const context = this.getContextValuesContainer(this._contextId);
    const result = rules!.evaluate(context);
    console.log(expression, result);
    return result;
  }

  public dispose() {
    this._isDisposed = true;
  }
}
