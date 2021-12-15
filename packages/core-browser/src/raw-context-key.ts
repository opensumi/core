import { IContextKeyService, IContextKey } from './context-key';

export abstract class IRawContextKey<T> {
  raw: string;
  not: string;
  abstract equalsTo(value: string): string;
  abstract notEqualTo(value: string): string;
  abstract regexMatches(regexp: RegExp): string;
  abstract bind(target: IContextKeyService): IContextKey<T>;
  abstract getValue(target: IContextKeyService): T | undefined;
}

type ContextkeyCombinedClause<T = any> = Array<RawContextKey<T> | string>;

function whenNormalizer(arr: ContextkeyCombinedClause, separator: '&&' | '||'): string {
  const result: string[] = [];
  if (Array.isArray(arr) && arr.length) {
    for (const item of arr) {
      if (item instanceof RawContextKey) {
        result.push(item.raw);
      } else {
        result.push(item);
      }
    }
  }

  return result.join(' ' + separator + ' ');
}

/**
 * 我们目前的 when 的使用并没有直接使用 monaco.contextkey.ContextKeyExpr
 * 实现了 bind/getValue 方法
 * 实现了 and/or/not/equals/notEquals/regexMatches 等工具方法
 * 实现了类似效果:
 * when: RawContextKey.and(ExplorerRootContext, ExplorerFolderContext)
 * 参考 https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
 */
export class RawContextKey<T> implements IRawContextKey<T> {
  private key: string;
  private defaultValue: T | undefined;

  /**
   * and alias '&&'
   */
  static and(...args: ContextkeyCombinedClause): string {
    if (!args.length) {
      return '';
    }
    return whenNormalizer(args, '&&');
  }

  /**
   * or alias '||'
   */
  static or(...args: ContextkeyCombinedClause) {
    if (!args.length) {
      return '';
    }
    return whenNormalizer(args, '||');
  }

  constructor(key: string, defaultValue: T | undefined) {
    this.key = key;
    this.defaultValue = defaultValue;
  }

  public bind(target: IContextKeyService): IContextKey<T> {
    return target.createKey(this.key, this.defaultValue);
  }

  public getValue(target: IContextKeyService): T | undefined {
    return target.getContextValue<T>(this.key);
  }

  /**
   * maybe you don't need use this directly
   */
  public get raw() {
    return this.key;
  }

  /**
   * get negated value
   */
  public get not() {
    return '!' + this.raw;
  }

  /**
   * is equal to
   */
  public equalsTo(value: string): string {
    return this.raw + ' == ' + value;
  }

  /**
   * is not equal to
   */
  public notEqualTo(value: string): string {
    return this.raw + ' != ' + value;
  }

  /**
   * matches regex
   */
  public regexMatches(regexp: RegExp): string {
    const regexpStr = regexp ? `/${regexp.source}/${regexp.ignoreCase ? 'i' : ''}` : '/invalid/';
    return this.raw + ' =~ ' + regexpStr;
  }

  public evaluate(target: IContextKeyService): boolean {
    return !!target.getValue(this.key);
  }
}
