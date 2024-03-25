import {
  Key,
  KeyCode,
  KeyModifier,
  KeySequence,
  KeybindingRegistry,
  Keystroke,
  isOSX,
} from '@opensumi/ide-core-browser';
import { AriaLabelProvider, UILabelProvider } from '@opensumi/monaco-editor-core/esm/vs/base/common/keybindingLabels';
import {
  KeyCodeChord,
  Keybinding,
  Modifiers,
  ResolvedChord,
  ResolvedKeybinding,
  ScanCodeChord,
  SingleModifierChord,
} from '@opensumi/monaco-editor-core/esm/vs/base/common/keybindings';
import { KeyCode as MonacoKeyCode } from '@opensumi/monaco-editor-core/esm/vs/base/common/keyCodes';
import * as platform from '@opensumi/monaco-editor-core/esm/vs/base/common/platform';
import { USLayoutResolvedKeybinding } from '@opensumi/monaco-editor-core/esm/vs/platform/keybinding/common/usLayoutResolvedKeybinding';

import { KEY_CODE_MAP } from './monaco.keycode-map';

export class MonacoResolvedKeybinding extends ResolvedKeybinding {
  hasMultipleChords(): boolean {
    return false;
  }
  getChords(): ResolvedChord[] {
    return [];
  }
  getDispatchChords(): (string | null)[] {
    return [];
  }
  getSingleModifierDispatchChords(): (SingleModifierChord | null)[] {
    return [];
  }
  protected readonly parts: { modifiers: Modifiers & { key: string | null } }[];

  constructor(protected readonly keySequence: KeySequence, keybindingService: KeybindingRegistry) {
    super();
    this.parts = keySequence.map((keyCode) => ({
      modifiers: {
        key: keyCode.key ? keybindingService.acceleratorForKey(keyCode.key) : null,
        ctrlKey: keyCode.ctrl,
        shiftKey: keyCode.shift,
        altKey: keyCode.alt,
        metaKey: keyCode.meta,
      },
    }));
  }

  public getLabel(): string | null {
    return UILabelProvider.toLabel(
      platform.OS,
      this.parts.map((part) => part.modifiers),
      this.keyLabelProvider,
    );
  }

  public getAriaLabel(): string | null {
    return AriaLabelProvider.toLabel(
      platform.OS,
      this.parts.map((part) => part.modifiers),
      this.keyLabelProvider,
    );
  }

  public getElectronAccelerator(): string | null {
    return this.getLabel();
  }

  public getUserSettingsLabel(): string | null {
    return this.getLabel();
  }

  public isWYSIWYG(): boolean {
    return true;
  }

  public isChord(): boolean {
    return this.parts.length > 1;
  }

  public getDispatchParts(): (string | null)[] {
    return this.parts.map((part, index) => {
      const keyCode = KEY_CODE_MAP[this.keySequence[index].key!.keyCode];
      return USLayoutResolvedKeybinding.getDispatchStr(
        new KeyCodeChord(
          part.modifiers.ctrlKey,
          part.modifiers.shiftKey,
          part.modifiers.altKey,
          part.modifiers.metaKey,
          keyCode,
        ),
      );
    });
  }

  getSingleModifierDispatchParts(): (SingleModifierChord | null)[] {
    return []; /* NOOP */
  }

  public getParts(): ResolvedChord[] {
    return this.parts.map(
      (part) =>
        new ResolvedChord(
          part.modifiers.ctrlKey,
          part.modifiers.shiftKey,
          part.modifiers.altKey,
          part.modifiers.metaKey,
          part.modifiers.key!,
          part.modifiers.key!,
        ),
    );
  }

  private keyLabelProvider<T extends Modifiers & { key: string | null }>(keybinding: T): string | null {
    return keybinding.key;
  }

  static keyCode(keybinding: KeyCodeChord | ScanCodeChord): KeyCode {
    const keyCode: MonacoKeyCode =
      keybinding instanceof KeyCodeChord
        ? keybinding.keyCode
        : USLayoutResolvedKeybinding['_scanCodeToKeyCode'](keybinding.scanCode);
    const sequence: Keystroke = {
      first: Key.getKey(this.monaco2BrowserKeyCode(keyCode & 0xff)),
      modifiers: [],
    };
    if (keybinding.ctrlKey) {
      if (isOSX) {
        sequence.modifiers?.push(KeyModifier.MacCtrl);
      } else {
        sequence.modifiers?.push(KeyModifier.CtrlCmd);
      }
    }
    if (keybinding.shiftKey) {
      sequence.modifiers?.push(KeyModifier.Shift);
    }
    if (keybinding.altKey) {
      sequence.modifiers?.push(KeyModifier.Alt);
    }
    if (keybinding.metaKey && sequence.modifiers?.indexOf(KeyModifier.CtrlCmd) === -1) {
      sequence.modifiers?.push(KeyModifier.CtrlCmd);
    }
    return KeyCode.createKeyCode(sequence);
  }

  static keySequence(keybinding: Keybinding): KeySequence {
    return keybinding.chords.map((part) => this.keyCode(part));
  }

  static monaco2BrowserKeyCode(keyCode: MonacoKeyCode): number {
    for (let i = 0; i < KEY_CODE_MAP.length; i++) {
      if (KEY_CODE_MAP[i] === keyCode) {
        return i;
      }
    }
    return -1;
  }

  static toKeybinding(keybinding: Keybinding): string {
    return keybinding.chords.map((binding) => this.keyCode(binding)).join(' ');
  }
}
