
import { IKeyboardLayoutInfo, IKeyboardMapping } from 'native-keymap';
import { Event } from '../event';

export const keyboardPath = '/services/keyboard';

export const KeyboardNativeLayoutService = Symbol('KeyboardNativeLayoutService');

export interface KeyboardNativeLayoutService {
  getNativeLayout(): Promise<NativeKeyboardLayout>;
}

export const KeyboardLayoutChangeNotifierService = Symbol('KeyboardLayoutChangeNotifierService');

export interface KeyboardLayoutChangeNotifierService {
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
