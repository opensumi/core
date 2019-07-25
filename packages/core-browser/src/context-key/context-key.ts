import { isFalsyOrWhitespace } from '@ali/ide-core-common';

export const enum ContextKeyExprType {
  Defined = 1,
  Not = 2,
  Equals = 3,
  NotEquals = 4,
  And = 5,
  Regex = 6,
}

export interface IContextKeyExprMapper {
  mapDefined(key: string): ContextKeyDefinedExpr;
  mapNot(key: string): ContextKeyNotExpr;
  mapEquals(key: string, value: any): ContextKeyEqualsExpr;
  mapNotEquals(key: string, value: any): ContextKeyNotEqualsExpr;
  mapRegex(key: string, regexp: RegExp | null): ContextKeyRegexExpr;
}

/**
 * ContextKeyExpr 抽象类，静态方法用于构建表达式同时进行表达式运算
 */
export abstract class ContextKeyExpr {

  public static has(key: string): ContextKeyExpr {
    return new ContextKeyDefinedExpr(key);
  }

  public static equals(key: string, value: any): ContextKeyExpr {
    return new ContextKeyEqualsExpr(key, value);
  }

  public static notEquals(key: string, value: any): ContextKeyExpr {
    return new ContextKeyNotEqualsExpr(key, value);
  }

  public static regex(key: string, value: RegExp): ContextKeyExpr {
    return new ContextKeyRegexExpr(key, value);
  }

  public static not(key: string): ContextKeyExpr {
    return new ContextKeyNotExpr(key);
  }

  public static and(...expr: Array<ContextKeyExpr | undefined | null>): ContextKeyExpr {
    return new ContextKeyAndExpr(expr);
  }

  public static deserialize(serialized: string | null | undefined, strict: boolean = false): ContextKeyExpr | undefined {
    if (!serialized) {
      return undefined;
    }

    const pieces = serialized.split('&&');
    const result = new ContextKeyAndExpr(pieces.map((p) => this._deserializeOne(p, strict)));
    return result.normalize();
  }

  private static _deserializeOne(serializedOne: string, strict: boolean): ContextKeyExpr {
    serializedOne = serializedOne.trim();

    if (serializedOne.indexOf('!=') >= 0) {
      const pieces = serializedOne.split('!=');
      return new ContextKeyNotEqualsExpr(pieces[0].trim(), this._deserializeValue(pieces[1], strict));
    }

    if (serializedOne.indexOf('==') >= 0) {
      const pieces = serializedOne.split('==');
      return new ContextKeyEqualsExpr(pieces[0].trim(), this._deserializeValue(pieces[1], strict));
    }

    if (serializedOne.indexOf('=~') >= 0) {
      const pieces = serializedOne.split('=~');
      return new ContextKeyRegexExpr(pieces[0].trim(), this._deserializeRegexValue(pieces[1], strict));
    }

    if (/^\!\s*/.test(serializedOne)) {
      return new ContextKeyNotExpr(serializedOne.substr(1).trim());
    }

    return new ContextKeyDefinedExpr(serializedOne);
  }

  private static _deserializeValue(serializedValue: string, strict: boolean): any {
    serializedValue = serializedValue.trim();

    if (serializedValue === 'true') {
      return true;
    }

    if (serializedValue === 'false') {
      return false;
    }

    const m = /^'([^']*)'$/.exec(serializedValue);
    if (m) {
      return m[1].trim();
    }

    return serializedValue;
  }

  private static _deserializeRegexValue(serializedValue: string, strict: boolean): RegExp | null {

    if (isFalsyOrWhitespace(serializedValue)) {
      if (strict) {
        throw new Error('missing regexp-value for =~-expression');
      } else {
        console.warn('missing regexp-value for =~-expression');
      }
      return null;
    }

    const start = serializedValue.indexOf('/');
    const end = serializedValue.lastIndexOf('/');
    if (start === end || start < 0 /* || to < 0 */) {
      if (strict) {
        throw new Error(`bad regexp-value '${serializedValue}', missing /-enclosure`);
      } else {
        console.warn(`bad regexp-value '${serializedValue}', missing /-enclosure`);
      }
      return null;
    }

    const value = serializedValue.slice(start + 1, end);
    const caseIgnoreFlag = serializedValue[end + 1] === 'i' ? 'i' : '';
    try {
      return new RegExp(value, caseIgnoreFlag);
    } catch (e) {
      if (strict) {
        throw new Error(`bad regexp-value '${serializedValue}', parse error: ${e}`);
      } else {
        console.warn(`bad regexp-value '${serializedValue}', parse error: ${e}`);
      }
      return null;
    }
  }

  public abstract getType(): ContextKeyExprType;
  public abstract equals(other: ContextKeyExpr): boolean;
  public abstract evaluate(context: IContext): boolean;
  public abstract normalize(): ContextKeyExpr | undefined;
  public abstract serialize(): string;
  public abstract keys(): string[];
  public abstract map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
}

export class ContextKeyDefinedExpr implements ContextKeyExpr {
  constructor(protected key: string) {
  }

  public getType(): ContextKeyExprType {
    return ContextKeyExprType.Defined;
  }

  public cmp(other: ContextKeyDefinedExpr): number {
    if (this.key < other.key) {
      return -1;
    }
    if (this.key > other.key) {
      return 1;
    }
    return 0;
  }

  public equals(other: ContextKeyExpr): boolean {
    if (other instanceof ContextKeyDefinedExpr) {
      return (this.key === other.key);
    }
    return false;
  }

  public evaluate(context: IContext): boolean {
    return (!!context.getValue(this.key));
  }

  public normalize(): ContextKeyExpr {
    return this;
  }

  public serialize(): string {
    return this.key;
  }

  public keys(): string[] {
    return [this.key];
  }

  public map(mapFnc: IContextKeyExprMapper): ContextKeyExpr {
    return mapFnc.mapDefined(this.key);
  }
}

export class ContextKeyEqualsExpr implements ContextKeyExpr {
  constructor(private readonly key: string, private readonly value: any) {
  }

  public getType(): ContextKeyExprType {
    return ContextKeyExprType.Equals;
  }

  public cmp(other: ContextKeyEqualsExpr): number {
    if (this.key < other.key) {
      return -1;
    }
    if (this.key > other.key) {
      return 1;
    }
    if (this.value < other.value) {
      return -1;
    }
    if (this.value > other.value) {
      return 1;
    }
    return 0;
  }

  public equals(other: ContextKeyExpr): boolean {
    if (other instanceof ContextKeyEqualsExpr) {
      return (this.key === other.key && this.value === other.value);
    }
    return false;
  }

  public evaluate(context: IContext): boolean {
    /* tslint:disable:triple-equals */
    // Intentional ==
    return (context.getValue(this.key) == this.value);
    /* tslint:enable:triple-equals */
  }

  public normalize(): ContextKeyExpr {
    if (typeof this.value === 'boolean') {
      if (this.value) {
        return new ContextKeyDefinedExpr(this.key);
      }
      return new ContextKeyNotExpr(this.key);
    }
    return this;
  }

  public serialize(): string {
    if (typeof this.value === 'boolean') {
      return this.normalize().serialize();
    }

    return this.key + ' == \'' + this.value + '\'';
  }

  public keys(): string[] {
    return [this.key];
  }

  public map(mapFnc: IContextKeyExprMapper): ContextKeyExpr {
    return mapFnc.mapEquals(this.key, this.value);
  }
}

export class ContextKeyNotEqualsExpr implements ContextKeyExpr {
  constructor(private key: string, private value: any) {
  }

  public getType(): ContextKeyExprType {
    return ContextKeyExprType.NotEquals;
  }

  public cmp(other: ContextKeyNotEqualsExpr): number {
    if (this.key < other.key) {
      return -1;
    }
    if (this.key > other.key) {
      return 1;
    }
    if (this.value < other.value) {
      return -1;
    }
    if (this.value > other.value) {
      return 1;
    }
    return 0;
  }

  public equals(other: ContextKeyExpr): boolean {
    if (other instanceof ContextKeyNotEqualsExpr) {
      return (this.key === other.key && this.value === other.value);
    }
    return false;
  }

  public evaluate(context: IContext): boolean {
    /* tslint:disable:triple-equals */
    // Intentional !=
    return (context.getValue(this.key) != this.value);
    /* tslint:enable:triple-equals */
  }

  public normalize(): ContextKeyExpr {
    if (typeof this.value === 'boolean') {
      if (this.value) {
        return new ContextKeyNotExpr(this.key);
      }
      return new ContextKeyDefinedExpr(this.key);
    }
    return this;
  }

  public serialize(): string {
    if (typeof this.value === 'boolean') {
      return this.normalize().serialize();
    }

    return this.key + ' != \'' + this.value + '\'';
  }

  public keys(): string[] {
    return [this.key];
  }

  public map(mapFnc: IContextKeyExprMapper): ContextKeyExpr {
    return mapFnc.mapNotEquals(this.key, this.value);
  }
}

export class ContextKeyNotExpr implements ContextKeyExpr {
  constructor(private key: string) {
  }

  public getType(): ContextKeyExprType {
    return ContextKeyExprType.Not;
  }

  public cmp(other: ContextKeyNotExpr): number {
    if (this.key < other.key) {
      return -1;
    }
    if (this.key > other.key) {
      return 1;
    }
    return 0;
  }

  public equals(other: ContextKeyExpr): boolean {
    if (other instanceof ContextKeyNotExpr) {
      return (this.key === other.key);
    }
    return false;
  }

  public evaluate(context: IContext): boolean {
    return (!context.getValue(this.key));
  }

  public normalize(): ContextKeyExpr {
    return this;
  }

  public serialize(): string {
    return '!' + this.key;
  }

  public keys(): string[] {
    return [this.key];
  }

  public map(mapFnc: IContextKeyExprMapper): ContextKeyExpr {
    return mapFnc.mapNot(this.key);
  }
}

export class ContextKeyRegexExpr implements ContextKeyExpr {

  constructor(private key: string, private regexp: RegExp | null) {
    //
  }

  public getType(): ContextKeyExprType {
    return ContextKeyExprType.Regex;
  }

  public cmp(other: ContextKeyRegexExpr): number {
    if (this.key < other.key) {
      return -1;
    }
    if (this.key > other.key) {
      return 1;
    }
    const thisSource = this.regexp ? this.regexp.source : '';
    const otherSource = other.regexp ? other.regexp.source : '';
    if (thisSource < otherSource) {
      return -1;
    }
    if (thisSource > otherSource) {
      return 1;
    }
    return 0;
  }

  public equals(other: ContextKeyExpr): boolean {
    if (other instanceof ContextKeyRegexExpr) {
      const thisSource = this.regexp ? this.regexp.source : '';
      const otherSource = other.regexp ? other.regexp.source : '';
      return (this.key === other.key && thisSource === otherSource);
    }
    return false;
  }

  public evaluate(context: IContext): boolean {
    const value = context.getValue<any>(this.key);
    return this.regexp ? this.regexp.test(value) : false;
  }

  public normalize(): ContextKeyExpr {
    return this;
  }

  public serialize(): string {
    const value = this.regexp
      ? `/${this.regexp.source}/${this.regexp.ignoreCase ? 'i' : ''}`
      : '/invalid/';
    return `${this.key} =~ ${value}`;
  }

  public keys(): string[] {
    return [this.key];
  }

  public map(mapFnc: IContextKeyExprMapper): ContextKeyExpr {
    return mapFnc.mapRegex(this.key, this.regexp);
  }
}

export class ContextKeyAndExpr implements ContextKeyExpr {
  public readonly expr: ContextKeyExpr[];

  constructor(expr: Array<ContextKeyExpr | null | undefined>) {
    this.expr = ContextKeyAndExpr._normalizeArr(expr);
  }

  public getType(): ContextKeyExprType {
    return ContextKeyExprType.And;
  }

  public equals(other: ContextKeyExpr): boolean {
    if (other instanceof ContextKeyAndExpr) {
      if (this.expr.length !== other.expr.length) {
        return false;
      }
      for (let i = 0, len = this.expr.length; i < len; i++) {
        if (!this.expr[i].equals(other.expr[i])) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  public evaluate(context: IContext): boolean {
    for (let i = 0, len = this.expr.length; i < len; i++) {
      if (!this.expr[i].evaluate(context)) {
        return false;
      }
    }
    return true;
  }

  private static _normalizeArr(arr: Array<ContextKeyExpr | null | undefined>): ContextKeyExpr[] {
    let expr: ContextKeyExpr[] = [];

    if (arr) {
      for (let i = 0, len = arr.length; i < len; i++) {
        let e: ContextKeyExpr | null | undefined = arr[i];
        if (!e) {
          continue;
        }

        e = e.normalize();
        if (!e) {
          continue;
        }

        if (e instanceof ContextKeyAndExpr) {
          expr = expr.concat(e.expr);
          continue;
        }

        expr.push(e);
      }

      expr.sort(cmp);
    }

    return expr;
  }

  public normalize(): ContextKeyExpr | undefined {
    if (this.expr.length === 0) {
      return undefined;
    }

    if (this.expr.length === 1) {
      return this.expr[0];
    }

    return this;
  }

  public serialize(): string {
    if (this.expr.length === 0) {
      return '';
    }
    if (this.expr.length === 1) {
      const normalized = this.normalize();
      if (!normalized) {
        return '';
      }
      return normalized.serialize();
    }
    return this.expr.map((e) => e.serialize()).join(' && ');
  }

  public keys(): string[] {
    const result: string[] = [];
    for (const expr of this.expr) {
      result.push(...expr.keys());
    }
    return result;
  }

  public map(mapFnc: IContextKeyExprMapper): ContextKeyExpr {
    return new ContextKeyAndExpr(this.expr.map((expr) => expr.map(mapFnc)));
  }
}

// 用于ContextKeyAndExpr._normalizeArr进行排序判断
function cmp(a: ContextKeyExpr, b: ContextKeyExpr): number {
  const aType = a.getType();
  const bType = b.getType();
  if (aType !== bType) {
    return aType - bType;
  }
  switch (aType) {
    case ContextKeyExprType.Defined:
      return (a as ContextKeyDefinedExpr).cmp(b as ContextKeyDefinedExpr);
    case ContextKeyExprType.Not:
      return (a as ContextKeyNotExpr).cmp(b as ContextKeyNotExpr);
    case ContextKeyExprType.Equals:
      return (a as ContextKeyEqualsExpr).cmp(b as ContextKeyEqualsExpr);
    case ContextKeyExprType.NotEquals:
      return (a as ContextKeyNotEqualsExpr).cmp(b as ContextKeyNotEqualsExpr);
    case ContextKeyExprType.Regex:
      return (a as ContextKeyRegexExpr).cmp(b as ContextKeyRegexExpr);
    default:
      throw new Error('Unknown ContextKeyExpr!');
  }
}

export class RawContextKey<T> extends ContextKeyDefinedExpr {

  private _defaultValue: T | undefined;

  constructor(key: string, defaultValue: T | undefined) {
    super(key);
    this._defaultValue = defaultValue;
  }

  public bindTo(target: IContextKeyService): IContextKey<T> {
    return target.createKey(this.key, this._defaultValue);
  }

  public getValue(target: IContextKeyService): T | undefined {
    return target.getContextKeyValue<T>(this.key);
  }

  public toNegated(): ContextKeyExpr {
    return ContextKeyExpr.not(this.key);
  }

  public isEqualTo(value: string): ContextKeyExpr {
    return ContextKeyExpr.equals(this.key, value);
  }

  public notEqualsTo(value: string): ContextKeyExpr {
    return ContextKeyExpr.notEquals(this.key, value);
  }
}

export interface IContextKeyServiceTarget {
  parentElement: IContextKeyServiceTarget | null;
  setAttribute(attr: string, value: string): void;
  removeAttribute(attr: string): void;
  hasAttribute(attr: string): boolean;
  getAttribute(attr: string): string | null;
}

export interface IContextKey<T> {
  set(value: T | undefined): void;
  reset(): void;
  get(key: string): T | undefined;
}

export interface IContext {
  getValue<T>(key: string): T | undefined;
}

/**
 * 指定作用域下上下文变量值集合 ContextKey 集合
 */
export class Context implements IContext {

  protected _parent: Context | null;
  protected _value: { [key: string]: any; };
  protected _id: number;

  constructor(id: number, parent: Context | null) {
    this._id = id;
    this._parent = parent;
    this._value = Object.create(null);
    this._value._contextId = id;
  }

  public setValue(key: string, value: any): boolean {
    if (this._value[key] !== value) {
      this._value[key] = value;
      return true;
    }
    return false;
  }

  public removeValue(key: string): boolean {
    if (key in this._value) {
      delete this._value[key];
      return true;
    }
    return false;
  }

  public getValue<T>(key: string): T | undefined {
    const ret = this._value[key];
    if (typeof ret === 'undefined' && this._parent) {
      return this._parent.getValue<T>(key);
    }
    return ret;
  }

  collectAllValues(): { [key: string]: any; } {
    let result = this._parent ? this._parent.collectAllValues() : Object.create(null);
    result = { ...result, ...this._value };
    delete result._contextId;
    return result;
  }
}

export const IContextKeyService = Symbol('IContextKeyService');

export interface IContextKeyService {
  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
  getContextKeyValue<T>(key: string): T | undefined;
  removeContext(key: string): void;
  setContext(key: string, value: any): void;
}
