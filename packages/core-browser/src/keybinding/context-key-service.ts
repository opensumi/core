import { Injectable } from '@ali/common-di';

export interface ContextKey<T> {
    set(value: T | undefined): void;
    reset(): void;
    get(): T | undefined;
}

export const ContextKey = {
  None: Object.freeze({
    set: () => { },
    reset: () => { },
    get: () => undefined,
  }) as ContextKey<any>,
};

@Injectable()
export class ContextKeyService {
    createKey<T>(key: string, defaultValue: T | undefined): ContextKey<T> {
        return ContextKey.None;
    }
    /**
     * It should be implemented by an extension, e.g. by the monaco extension.
     */
    match(expression: string, context?: HTMLElement): boolean {
        return true;
    }
}
