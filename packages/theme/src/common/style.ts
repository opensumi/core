import { IDisposable } from '@opensumi/ide-core-common';

export interface IStyleInsertResult extends IDisposable {
  index: number;
}

export interface IStyleSheet {
  insertSelector(selector: string, rule: string): IStyleInsertResult;
  deleteRule(index: number): void;
}

export interface ICSSStyleService {
  /**
   * @deprecated pls use
   */
  addClass(classname: string, style: Partial<CSSStyleDeclaration>): IDisposable;
  /**
   * @deprecated
   */
  removeClass(classname: string): void;

  acquire(key: string): IStyleSheet;
}

export const ICSSStyleService = Symbol('ICSSStyleService');
