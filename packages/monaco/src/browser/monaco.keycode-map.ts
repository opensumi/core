import { isWebKit, isMacintosh } from '@opensumi/ide-core-common';
import { KeyCode as KeyCodeEnum } from '@opensumi/monaco-editor-core/esm/vs/base/common/keyCodes';

export const KEY_CODE_MAP: KeyCodeEnum[] = [];
(() => {
  KEY_CODE_MAP[3] = KeyCodeEnum.PauseBreak; // VK_CANCEL 0x03 Control-break processing
  KEY_CODE_MAP[8] = KeyCodeEnum.Backspace;
  KEY_CODE_MAP[9] = KeyCodeEnum.Tab;
  KEY_CODE_MAP[13] = KeyCodeEnum.Enter;
  KEY_CODE_MAP[16] = KeyCodeEnum.Shift;
  KEY_CODE_MAP[17] = KeyCodeEnum.Ctrl;
  KEY_CODE_MAP[18] = KeyCodeEnum.Alt;
  KEY_CODE_MAP[19] = KeyCodeEnum.PauseBreak;
  KEY_CODE_MAP[20] = KeyCodeEnum.CapsLock;
  KEY_CODE_MAP[27] = KeyCodeEnum.Escape;
  KEY_CODE_MAP[32] = KeyCodeEnum.Space;
  KEY_CODE_MAP[33] = KeyCodeEnum.PageUp;
  KEY_CODE_MAP[34] = KeyCodeEnum.PageDown;
  KEY_CODE_MAP[35] = KeyCodeEnum.End;
  KEY_CODE_MAP[36] = KeyCodeEnum.Home;
  KEY_CODE_MAP[37] = KeyCodeEnum.LeftArrow;
  KEY_CODE_MAP[38] = KeyCodeEnum.UpArrow;
  KEY_CODE_MAP[39] = KeyCodeEnum.RightArrow;
  KEY_CODE_MAP[40] = KeyCodeEnum.DownArrow;
  KEY_CODE_MAP[45] = KeyCodeEnum.Insert;
  KEY_CODE_MAP[46] = KeyCodeEnum.Delete;

  KEY_CODE_MAP[48] = KeyCodeEnum.Digit0;
  KEY_CODE_MAP[49] = KeyCodeEnum.Digit1;
  KEY_CODE_MAP[50] = KeyCodeEnum.Digit2;
  KEY_CODE_MAP[51] = KeyCodeEnum.Digit3;
  KEY_CODE_MAP[52] = KeyCodeEnum.Digit4;
  KEY_CODE_MAP[53] = KeyCodeEnum.Digit5;
  KEY_CODE_MAP[54] = KeyCodeEnum.Digit6;
  KEY_CODE_MAP[55] = KeyCodeEnum.Digit7;
  KEY_CODE_MAP[56] = KeyCodeEnum.Digit8;
  KEY_CODE_MAP[57] = KeyCodeEnum.Digit9;

  KEY_CODE_MAP[65] = KeyCodeEnum.KeyA;
  KEY_CODE_MAP[66] = KeyCodeEnum.KeyB;
  KEY_CODE_MAP[67] = KeyCodeEnum.KeyC;
  KEY_CODE_MAP[68] = KeyCodeEnum.KeyD;
  KEY_CODE_MAP[69] = KeyCodeEnum.KeyE;
  KEY_CODE_MAP[70] = KeyCodeEnum.KeyF;
  KEY_CODE_MAP[71] = KeyCodeEnum.KeyG;
  KEY_CODE_MAP[72] = KeyCodeEnum.KeyH;
  KEY_CODE_MAP[73] = KeyCodeEnum.KeyI;
  KEY_CODE_MAP[74] = KeyCodeEnum.KeyJ;
  KEY_CODE_MAP[75] = KeyCodeEnum.KeyK;
  KEY_CODE_MAP[76] = KeyCodeEnum.KeyL;
  KEY_CODE_MAP[77] = KeyCodeEnum.KeyM;
  KEY_CODE_MAP[78] = KeyCodeEnum.KeyN;
  KEY_CODE_MAP[79] = KeyCodeEnum.KeyO;
  KEY_CODE_MAP[80] = KeyCodeEnum.KeyP;
  KEY_CODE_MAP[81] = KeyCodeEnum.KeyQ;
  KEY_CODE_MAP[82] = KeyCodeEnum.KeyR;
  KEY_CODE_MAP[83] = KeyCodeEnum.KeyS;
  KEY_CODE_MAP[84] = KeyCodeEnum.KeyT;
  KEY_CODE_MAP[85] = KeyCodeEnum.KeyU;
  KEY_CODE_MAP[86] = KeyCodeEnum.KeyV;
  KEY_CODE_MAP[87] = KeyCodeEnum.KeyW;
  KEY_CODE_MAP[88] = KeyCodeEnum.KeyX;
  KEY_CODE_MAP[89] = KeyCodeEnum.KeyY;
  KEY_CODE_MAP[90] = KeyCodeEnum.KeyZ;

  KEY_CODE_MAP[93] = KeyCodeEnum.ContextMenu;

  KEY_CODE_MAP[96] = KeyCodeEnum.Numpad0;
  KEY_CODE_MAP[97] = KeyCodeEnum.Numpad1;
  KEY_CODE_MAP[98] = KeyCodeEnum.Numpad2;
  KEY_CODE_MAP[99] = KeyCodeEnum.Numpad3;
  KEY_CODE_MAP[100] = KeyCodeEnum.Numpad4;
  KEY_CODE_MAP[101] = KeyCodeEnum.Numpad5;
  KEY_CODE_MAP[102] = KeyCodeEnum.Numpad6;
  KEY_CODE_MAP[103] = KeyCodeEnum.Numpad7;
  KEY_CODE_MAP[104] = KeyCodeEnum.Numpad8;
  KEY_CODE_MAP[105] = KeyCodeEnum.Numpad9;
  KEY_CODE_MAP[106] = KeyCodeEnum.NumpadMultiply;
  KEY_CODE_MAP[107] = KeyCodeEnum.NumpadAdd;
  KEY_CODE_MAP[108] = KeyCodeEnum.NUMPAD_SEPARATOR;
  KEY_CODE_MAP[109] = KeyCodeEnum.NumpadSubtract;
  KEY_CODE_MAP[110] = KeyCodeEnum.NumpadDecimal;
  KEY_CODE_MAP[111] = KeyCodeEnum.NumpadDivide;

  KEY_CODE_MAP[112] = KeyCodeEnum.F1;
  KEY_CODE_MAP[113] = KeyCodeEnum.F2;
  KEY_CODE_MAP[114] = KeyCodeEnum.F3;
  KEY_CODE_MAP[115] = KeyCodeEnum.F4;
  KEY_CODE_MAP[116] = KeyCodeEnum.F5;
  KEY_CODE_MAP[117] = KeyCodeEnum.F6;
  KEY_CODE_MAP[118] = KeyCodeEnum.F7;
  KEY_CODE_MAP[119] = KeyCodeEnum.F8;
  KEY_CODE_MAP[120] = KeyCodeEnum.F9;
  KEY_CODE_MAP[121] = KeyCodeEnum.F10;
  KEY_CODE_MAP[122] = KeyCodeEnum.F11;
  KEY_CODE_MAP[123] = KeyCodeEnum.F12;
  KEY_CODE_MAP[124] = KeyCodeEnum.F13;
  KEY_CODE_MAP[125] = KeyCodeEnum.F14;
  KEY_CODE_MAP[126] = KeyCodeEnum.F15;
  KEY_CODE_MAP[127] = KeyCodeEnum.F16;
  KEY_CODE_MAP[128] = KeyCodeEnum.F17;
  KEY_CODE_MAP[129] = KeyCodeEnum.F18;
  KEY_CODE_MAP[130] = KeyCodeEnum.F19;

  KEY_CODE_MAP[144] = KeyCodeEnum.NumLock;
  KEY_CODE_MAP[145] = KeyCodeEnum.ScrollLock;

  KEY_CODE_MAP[186] = KeyCodeEnum.Semicolon;
  KEY_CODE_MAP[187] = KeyCodeEnum.Equal;
  KEY_CODE_MAP[188] = KeyCodeEnum.Comma;
  KEY_CODE_MAP[189] = KeyCodeEnum.Minus;
  KEY_CODE_MAP[190] = KeyCodeEnum.Period;
  KEY_CODE_MAP[191] = KeyCodeEnum.Slash;
  KEY_CODE_MAP[192] = KeyCodeEnum.Backquote;
  KEY_CODE_MAP[193] = KeyCodeEnum.ABNT_C1;
  KEY_CODE_MAP[194] = KeyCodeEnum.ABNT_C2;
  KEY_CODE_MAP[219] = KeyCodeEnum.BracketLeft;
  KEY_CODE_MAP[220] = KeyCodeEnum.Backslash;
  KEY_CODE_MAP[221] = KeyCodeEnum.BracketRight;
  KEY_CODE_MAP[222] = KeyCodeEnum.Quote;
  KEY_CODE_MAP[223] = KeyCodeEnum.OEM_8;

  KEY_CODE_MAP[226] = KeyCodeEnum.IntlBackslash;

  /**
   * https://lists.w3.org/Archives/Public/www-dom/2010JulSep/att-0182/keyCode-spec.html
   * If an Input Method Editor is processing key input and the event is keydown, return 229.
   */
  KEY_CODE_MAP[229] = KeyCodeEnum.KEY_IN_COMPOSITION;

  KEY_CODE_MAP[91] = KeyCodeEnum.Meta;
  if (isWebKit) {
    if (isMacintosh) {
      // the two meta keys in the Mac have different key codes (91 and 93)
      KEY_CODE_MAP[93] = KeyCodeEnum.Meta;
    } else {
      KEY_CODE_MAP[92] = KeyCodeEnum.Meta;
    }
  }
})();
