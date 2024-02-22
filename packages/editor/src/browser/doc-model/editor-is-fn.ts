import { IEOLStackElement, IEditStackElement, IStackElement } from './types';

export function isEditStack(element: IStackElement): element is IEditStackElement {
  return !!(element as IEditStackElement).editOperations;
}

export function isEOLStack(element: IStackElement): element is IEOLStackElement {
  return !!(element as IEOLStackElement).eol;
}
