import { IContextKeyExpr } from './keybinding';
import { Event, BasicEvent } from '@ali/ide-core-common';

export interface IContextKey<T> {
  set(value: T | undefined): void;
  reset(): void;
  get(): T | undefined;
}

export const IContextKeyService = Symbol('IContextKeyService');

export interface IContextKeyService {
  onDidChangeContext: Event<ContextKeyChangeEvent>;

  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
  match(expression: string | IContextKeyExpr | undefined, context?: HTMLElement): boolean;
  getKeysInWhen(when: string | IContextKeyExpr | undefined): string[];
  getContextValue<T>(key: string): T | undefined;

  createScoped(domNode?: monaco.contextkey.IContextKeyServiceTarget): IContextKeyService;

  dispose(): void;
}

export interface IContextKeyChangeEventPayload {
  affectsSome(keys: IReadableSet<string>): boolean;
}

export interface IReadableSet<T> {
  has(value: T): boolean;
}

export class ContextKeyChangeEvent extends BasicEvent<IContextKeyChangeEventPayload> {}
