import { IDisposable } from '@opensumi/ide-core-common';

export interface IStyleInsertResult extends IDisposable {
  index: number;
}

export const emptyResult: IStyleInsertResult = {
  index: -1,
  dispose: () => {},
};

export interface IStyleSheet {
  insertSelector(selector: string, rule: string): IStyleInsertResult;
  removeRuleBySelector(selector: string): void;
  deleteRule(index: number): void;
}

export interface ICSSStyleService {
  addClass(classname: string, style: Partial<CSSStyleDeclaration>): IDisposable;
  removeClass(classname: string): void;
}

export const ICSSStyleService = Symbol('ICSSStyleService');
