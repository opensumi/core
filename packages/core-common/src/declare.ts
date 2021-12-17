export type ConstructorOf<T, K extends any[] = any[]> = new (...args: K) => T;

export type MaybeNull<T> = T | null | undefined;
