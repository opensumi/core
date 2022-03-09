import { Injectable } from '@opensumi/di';
import { ContextKeyChangeEvent, IScopedContextKeyService, IContextKey } from '@opensumi/ide-core-browser';
import { Event } from '@opensumi/ide-core-common';
import { isFalsyOrWhitespace } from '@opensumi/ide-core-common';
import { ContextKeyExpression } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

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

// inspired by https://github.com/microsoft/vscode/blob/master/src/vs/platform/contextkey/common/contextkey.ts#L83
class WhenExpressionParser {
  static parse(expression: string | undefined, data: any) {
    if (!expression) {
      return true;
    }

    const expr = expression.replace(/==/g, '===').replace(/!=/g, '!==');
    const orPieces = expr.split('||');
    const templateStr = orPieces.map((orPiece) => this._deserializeOne(orPiece, data)).join('||');

    return eval(templateStr);
  }

  private static _deserializeOne(serializedOne: string, data: any) {
    if (serializedOne.includes('!==')) {
      const [pieceLeft, pieceRight] = serializedOne.split('!==');
      const left = data[pieceLeft.trim()];
      return left !== this.deserialize(pieceRight.trim());
    }

    if (serializedOne.includes('===')) {
      const [pieceLeft, pieceRight] = serializedOne.split('===');
      const left = data[pieceLeft.trim()];
      return left === this.deserialize(pieceRight.trim());
    }

    if (serializedOne.includes('=~')) {
      const [pieceLeft, pieceRight] = serializedOne.split('=~');
      const left = data[pieceLeft.trim()];
      const regexp = this.deserializeRegex(pieceRight.trim());
      if (regexp) {
        return regexp.test(left);
      }
      return true;
    }

    // handle `!one`
    if (/^\!\s*/.test(serializedOne)) {
      const value = data[serializedOne.substr(1)];
      return !value;
    }

    return !!data[serializedOne];
  }

  // 解析基本类型
  private static deserialize(serializedValue: string) {
    const ret = [
      {
        true: true,
        false: false,
      },
    ][serializedValue];

    if (ret !== undefined) {
      return ret;
    }

    const m = /^'([^']*)'$/.exec(serializedValue);
    if (m) {
      return m[1].trim();
    }

    return serializedValue;
  }

  // 解析正则表达式
  private static deserializeRegex(serializedValue: string): RegExp | null {
    if (isFalsyOrWhitespace(serializedValue)) {
      // eslint-disable-next-line no-console
      console.warn('missing regexp-value for =~-expression');
      return null;
    }

    const start = serializedValue.indexOf('/');
    const end = serializedValue.lastIndexOf('/');
    if (start === end || start < 0 /* || to < 0 */) {
      // eslint-disable-next-line no-console
      console.warn(`bad regexp-value '${serializedValue}', missing /-enclosure`);
      return null;
    }

    const value = serializedValue.slice(start + 1, end);
    const caseIgnoreFlag = serializedValue[end + 1] === 'i' ? 'i' : '';
    try {
      return new RegExp(value, caseIgnoreFlag);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`bad regexp-value '${serializedValue}', parse error: ${e}`);
      return null;
    }
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

  getValue<T>(key: string): T | undefined {
    return this.getContextValue(key);
  }

  match(expression: string | ContextKeyExpression | undefined, context?: HTMLElement | null | undefined): boolean {
    if (typeof expression === 'string') {
      return WhenExpressionParser.parse(expression, this.getData());
    }

    return false;
  }

  private getData() {
    return Array.from(this._keys.keys()).reduce((prev, key) => {
      prev[key] = this.getContextValue(key);
      return prev;
    }, {});
  }

  getKeysInWhen(when: string | ContextKeyExpression | undefined) {
    let expr: ContextKeyExpression | undefined;
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

  parse(when: string | undefined): ContextKeyExpression | undefined {
    return undefined;
  }

  attachToDomNode(domNode) {
    return;
  }
}
