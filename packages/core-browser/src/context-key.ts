export interface IContextKey<T> {
  set(value: T | undefined): void;
  reset(): void;
  get(): T | undefined;
}

export const IContextKeyService = Symbol('IContextKeyService');

export interface IContextKeyService {
  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
  match(expression: string, context?: HTMLElement): boolean;
}
