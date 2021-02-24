import { ContextKeyExpr } from '@ali/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import { Injectable } from '@ali/common-di';
import { IScopedContextKeyService, IContextKey, ContextKeyChangeEvent, Event } from '@ali/ide-core-browser';
import { IStatusBarService } from '@ali/ide-status-bar/lib/common';

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
export class MockContextKeyService implements IScopedContextKeyService {
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

  public createScoped(domNode: HTMLElement): IScopedContextKeyService {
    return this;
  }

  match(expression: string | ContextKeyExpr | undefined, context?: HTMLElement | null | undefined): boolean {
    return false;
  }

  getKeysInWhen(when: string | ContextKeyExpr | undefined) {
    let expr: ContextKeyExpr | undefined;
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

  parse(when: string | undefined): ContextKeyExpr | undefined {
    return undefined;
  }

  attachToDomNode(domNode) {
    return;
  }
}

@Injectable()
export class MockStatusBarService implements IStatusBarService {
  getBackgroundColor() { return 'white'; }
  setColor() { }
  addElement() { return null as any; }
  setBackgroundColor() { }
  setElement() { }
  removeElement() { }
  leftEntries = [];
  rightEntries = [];
}

@Injectable()
export class MockEditorService {
  open() { }
}
