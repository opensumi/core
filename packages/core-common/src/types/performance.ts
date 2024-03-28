import { MaybePromise } from '../utils';

export const IPerformance = Symbol('IPerformance');

export interface IPerformance {
  measure<T>(name: string, fn: () => MaybePromise<T>): Promise<T>;
}
