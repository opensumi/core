import { IDisposable } from '@ali/ide-core-common';

export interface ICSSStyleService {

  addClass(classname: string, style: CSSStyleDeclaration): IDisposable;

  removeClass(classname: string);
}

export const ICSSStyleService = Symbol('ICSSStyleService');
