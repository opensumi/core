import { ContextKeyChangeEvent, IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { Event } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';

class MockKeybindingContextKey<T> implements IContextKey<T> {
  private _defaultValue: T | undefined;
  private _value: T | undefined;

  constructor(defaultValue: T | undefined) {
    this._defaultValue = defaultValue;
    this._value = this._defaultValue;
  }

  public set(value: T | undefined): void {
    this._value = value;
  }

  public reset(): void {
    this._value = this._defaultValue;
  }

  public get(): T | undefined {
    return this._value;
  }
}

@Injectable()
export class MockContextKeyService implements IContextKeyService {
  private _keys = new Map<string, IContextKey<any>>();

  public dispose(): void {
    //
  }

  public createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T> {
    const ret = new MockKeybindingContextKey(defaultValue);
    this._keys.set(key, ret);
    return ret;
  }

  public get onDidChangeContext(): Event<ContextKeyChangeEvent> {
    return Event.None;
  }

  public createScoped(domNode: HTMLElement): IContextKeyService {
    return this;
  }

  match(expression: string | monaco.contextkey.ContextKeyExpr | undefined, context?: HTMLElement | null | undefined): boolean {
    return false;
  }

  getKeysInWhen(when: string | monaco.contextkey.ContextKeyExpr | undefined) {
    let expr: monaco.contextkey.ContextKeyExpr | undefined;
    if (typeof when === 'string') {
      expr = this.parse(when);
    }
    return expr ? expr.keys() : [];
  }

  getContextValue<T>(key: string): T | undefined {
    const value = this._keys.get(key);
    if (value) {
      return value.get();
    }
  }

  parse(when: string | undefined): monaco.contextkey.ContextKeyExpr | undefined {
    return undefined;
  }
}
