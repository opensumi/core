import { RawContextKey } from './context-key';

// 定义全局通用的ContextKey
export const InputFocusedContextKey = 'inputFocus';
export const InputFocusedContext = new RawContextKey<boolean>(InputFocusedContextKey, false);
