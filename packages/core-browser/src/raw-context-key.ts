import { IContextKeyService, IContextKey } from './context-key';

/**
 * 这里只实现了 RawContextKey 的 bindTo/getValue 方法
 * 我们目前的 when 的使用并没有直接使用 monaco.contextkey.ContextKeyExpr
 * when: ContextKeyExpr.and(ExplorerRootContext, ExplorerFolderContext)
 * todo: 需要考虑是否需要支持类似 vscode 上方写法, string 也能满足需求
 */
export class RawContextKey<T> {
  private key: string;
  private defaultValue: T | undefined;

  constructor(key: string, defaultValue: T | undefined) {
    this.key = key;
    this.defaultValue = defaultValue;
  }

  public bind(target: IContextKeyService): IContextKey<T> {
    return target.createKey(this.key, this.defaultValue);
  }

  public getContextValue(target: IContextKeyService): T | undefined {
    return target.getContextValue<T>(this.key);
  }
}
