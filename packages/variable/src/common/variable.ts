import { URI } from '@opensumi/ide-core-browser';

export interface VariableResolveOptions {
  context?: URI;
}

export const IVariableResolverService = Symbol('IVariableResolverService');

export interface IVariableResolverService {
  resolve<T>(value: T, options?: VariableResolveOptions): Promise<T>;
  resolveArray(value: string[], options?: VariableResolveOptions): Promise<string[]>;
}
