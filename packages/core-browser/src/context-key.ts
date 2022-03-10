import { Event, BasicEvent } from '@opensumi/ide-core-common';
import { ContextKeyService } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/browser/contextKeyService';
import {
  ContextKeyExpr,
  IContextKeyServiceTarget,
} from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

export interface IContextKey<T> {
  set(value: T | undefined): void;
  reset(): void;
  get(): T | undefined;
}

export const IContextKeyService = Symbol('IContextKeyService');

export interface IContextKeyService {
  onDidChangeContext: Event<ContextKeyChangeEvent>;

  getValue<T>(key: string): T | undefined;
  createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
  match(expression: string | ContextKeyExpr | undefined, context?: HTMLElement | null): boolean;
  getKeysInWhen(when: string | ContextKeyExpr | undefined): string[];
  getContextValue<T>(key: string): T | undefined;

  createScoped(target?: IContextKeyServiceTarget | ContextKeyService): IScopedContextKeyService;

  parse(when: string | undefined): ContextKeyExpr | undefined;
  dispose(): void;
}

export interface IScopedContextKeyService extends IContextKeyService {
  attachToDomNode(domNode: HTMLElement): void;
}

export interface IContextKeyChangeEventPayload {
  affectsSome(keys: IReadableSet<string>): boolean;
}

export interface IReadableSet<T> {
  has(value: T): boolean;
}

export class ContextKeyChangeEvent extends BasicEvent<IContextKeyChangeEventPayload> {}
