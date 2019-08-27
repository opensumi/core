import { IContextKeyExpr } from './keybinding';
import { Event, BasicEvent } from '@ali/ide-core-common';

export interface IContextKey<T> {
  set(value: T | undefined): void;
  reset(): void;
  get(): T | undefined;
}

export const IContextKeyService = Symbol('IContextKeyService');

export interface IContextKeyService {
  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
  match(expression: string | IContextKeyExpr, context?: HTMLElement): boolean;
  getKeysInWhen(when: string): string[];
  getContextValue<T>(key: string): T;
}

export interface IContextKeyChangeEventPayload {
  affectsSome(keys: IReadableSet<string>): boolean;
}

export interface IReadableSet<T> {
  has(value: T): boolean;
}

export class ContextKeyChangeEvent extends BasicEvent<IContextKeyChangeEventPayload> {}
