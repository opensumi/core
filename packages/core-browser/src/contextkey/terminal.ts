import { RawContextKey } from '../raw-context-key';

/**
 * Context Keys to use with keybindings for the Terminal
 */
export const IsTerminalViewInitialized = new RawContextKey<boolean>('isTerminalViewInitialized', false);
export const IsTerminalFocused = new RawContextKey<boolean>('isTerminalFocused', false);
export const ShellExecutionSupported = new RawContextKey<boolean>('shellExecutionSupported', true);
