import { isWebKit, isMacintosh } from '@opensumi/ide-core-common/lib/platform';
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

  KEY_CODE_MAP[48] = KeyCodeEnum.KEY_0;
  KEY_CODE_MAP[49] = KeyCodeEnum.KEY_1;
  KEY_CODE_MAP[50] = KeyCodeEnum.KEY_2;
  KEY_CODE_MAP[51] = KeyCodeEnum.KEY_3;
  KEY_CODE_MAP[52] = KeyCodeEnum.KEY_4;
  KEY_CODE_MAP[53] = KeyCodeEnum.KEY_5;
  KEY_CODE_MAP[54] = KeyCodeEnum.KEY_6;
  KEY_CODE_MAP[55] = KeyCodeEnum.KEY_7;
  KEY_CODE_MAP[56] = KeyCodeEnum.KEY_8;
  KEY_CODE_MAP[57] = KeyCodeEnum.KEY_9;

  KEY_CODE_MAP[65] = KeyCodeEnum.KEY_A;
  KEY_CODE_MAP[66] = KeyCodeEnum.KEY_B;
  KEY_CODE_MAP[67] = KeyCodeEnum.KEY_C;
  KEY_CODE_MAP[68] = KeyCodeEnum.KEY_D;
  KEY_CODE_MAP[69] = KeyCodeEnum.KEY_E;
  KEY_CODE_MAP[70] = KeyCodeEnum.KEY_F;
  KEY_CODE_MAP[71] = KeyCodeEnum.KEY_G;
  KEY_CODE_MAP[72] = KeyCodeEnum.KEY_H;
  KEY_CODE_MAP[73] = KeyCodeEnum.KEY_I;
  KEY_CODE_MAP[74] = KeyCodeEnum.KEY_J;
  KEY_CODE_MAP[75] = KeyCodeEnum.KEY_K;
  KEY_CODE_MAP[76] = KeyCodeEnum.KEY_L;
  KEY_CODE_MAP[77] = KeyCodeEnum.KEY_M;
  KEY_CODE_MAP[78] = KeyCodeEnum.KEY_N;
  KEY_CODE_MAP[79] = KeyCodeEnum.KEY_O;
  KEY_CODE_MAP[80] = KeyCodeEnum.KEY_P;
  KEY_CODE_MAP[81] = KeyCodeEnum.KEY_Q;
  KEY_CODE_MAP[82] = KeyCodeEnum.KEY_R;
  KEY_CODE_MAP[83] = KeyCodeEnum.KEY_S;
  KEY_CODE_MAP[84] = KeyCodeEnum.KEY_T;
  KEY_CODE_MAP[85] = KeyCodeEnum.KEY_U;
  KEY_CODE_MAP[86] = KeyCodeEnum.KEY_V;
  KEY_CODE_MAP[87] = KeyCodeEnum.KEY_W;
  KEY_CODE_MAP[88] = KeyCodeEnum.KEY_X;
  KEY_CODE_MAP[89] = KeyCodeEnum.KEY_Y;
  KEY_CODE_MAP[90] = KeyCodeEnum.KEY_Z;

  KEY_CODE_MAP[93] = KeyCodeEnum.ContextMenu;

  KEY_CODE_MAP[96] = KeyCodeEnum.NUMPAD_0;
  KEY_CODE_MAP[97] = KeyCodeEnum.NUMPAD_1;
  KEY_CODE_MAP[98] = KeyCodeEnum.NUMPAD_2;
  KEY_CODE_MAP[99] = KeyCodeEnum.NUMPAD_3;
  KEY_CODE_MAP[100] = KeyCodeEnum.NUMPAD_4;
  KEY_CODE_MAP[101] = KeyCodeEnum.NUMPAD_5;
  KEY_CODE_MAP[102] = KeyCodeEnum.NUMPAD_6;
  KEY_CODE_MAP[103] = KeyCodeEnum.NUMPAD_7;
  KEY_CODE_MAP[104] = KeyCodeEnum.NUMPAD_8;
  KEY_CODE_MAP[105] = KeyCodeEnum.NUMPAD_9;
  KEY_CODE_MAP[106] = KeyCodeEnum.NUMPAD_MULTIPLY;
  KEY_CODE_MAP[107] = KeyCodeEnum.NUMPAD_ADD;
  KEY_CODE_MAP[108] = KeyCodeEnum.NUMPAD_SEPARATOR;
  KEY_CODE_MAP[109] = KeyCodeEnum.NUMPAD_SUBTRACT;
  KEY_CODE_MAP[110] = KeyCodeEnum.NUMPAD_DECIMAL;
  KEY_CODE_MAP[111] = KeyCodeEnum.NUMPAD_DIVIDE;

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

  KEY_CODE_MAP[186] = KeyCodeEnum.US_SEMICOLON;
  KEY_CODE_MAP[187] = KeyCodeEnum.US_EQUAL;
  KEY_CODE_MAP[188] = KeyCodeEnum.US_COMMA;
  KEY_CODE_MAP[189] = KeyCodeEnum.US_MINUS;
  KEY_CODE_MAP[190] = KeyCodeEnum.US_DOT;
  KEY_CODE_MAP[191] = KeyCodeEnum.US_SLASH;
  KEY_CODE_MAP[192] = KeyCodeEnum.US_BACKTICK;
  KEY_CODE_MAP[193] = KeyCodeEnum.ABNT_C1;
  KEY_CODE_MAP[194] = KeyCodeEnum.ABNT_C2;
  KEY_CODE_MAP[219] = KeyCodeEnum.US_OPEN_SQUARE_BRACKET;
  KEY_CODE_MAP[220] = KeyCodeEnum.US_BACKSLASH;
  KEY_CODE_MAP[221] = KeyCodeEnum.US_CLOSE_SQUARE_BRACKET;
  KEY_CODE_MAP[222] = KeyCodeEnum.US_QUOTE;
  KEY_CODE_MAP[223] = KeyCodeEnum.OEM_8;

  KEY_CODE_MAP[226] = KeyCodeEnum.OEM_102;

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
