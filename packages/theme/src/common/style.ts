import { IDisposable } from '@opensumi/ide-core-common';

export interface ICSSStyleService {
  addClass(classname: string, style: Partial<CSSStyleDeclaration>): IDisposable;

  removeClass(classname: string);
}

export const ICSSStyleService = Symbol('ICSSStyleService');
