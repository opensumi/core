
import { IKeyboardLayoutInfo, IKeyboardMapping } from 'native-keymap';
import { Event } from '../event';

export const keyboardPath = '/services/keyboard';

export const KeyboardLayoutProvider = Symbol('KeyboardLayoutProvider');

export interface KeyboardLayoutProvider {
  getNativeLayout(): Promise<NativeKeyboardLayout>;
}

export const KeyboardLayoutChangeNotifier = Symbol('KeyboardLayoutChangeNotifier');

export interface KeyboardLayoutChangeNotifier {
  onDidChangeNativeLayout: Event<NativeKeyboardLayout>;
}

export interface KeyValidationInput {
  code: string;
  character: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

export const KeyValidator = Symbol('KeyValidator');

export interface KeyValidator {
  validateKey(input: KeyValidationInput): void;
}

export interface NativeKeyboardLayout {
  info: IKeyboardLayoutInfo;
  mapping: IKeyboardMapping;
}
