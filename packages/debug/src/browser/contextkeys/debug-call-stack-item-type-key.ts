import { IContextKey } from '@ide-framework/ide-core-browser';

export const DebugCallStackItemTypeKey = Symbol('DebugCallStackItemTypeKey');
export type DebugCallStackItemTypeKey = IContextKey<'session' | 'thread' | 'stackFrame'>;
