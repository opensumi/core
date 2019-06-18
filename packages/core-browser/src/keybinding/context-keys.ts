import { RawContextKey } from './context-key';

export const InputFocusedContextKey = 'inputFocus';
export const InputFocusedContext = new RawContextKey<boolean>(InputFocusedContextKey, false);
