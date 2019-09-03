import { URI } from '@ali/ide-core-browser';

export interface VariableResolveOptions {
  context?: URI;
}

export const IVariableResolverService = Symbol('IVariableResolverService');

export interface IVariableResolverService {
  resolve<T>(value: T, options: VariableResolveOptions): Promise<T>;
}
