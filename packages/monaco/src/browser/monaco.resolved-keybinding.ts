import {
  KeySequence,
  KeybindingRegistry,
  Key,
  isOSX,
  KeyModifier,
  KeyCode,
  Keystroke,
} from '@opensumi/ide-core-browser';
import { KeyCode as MonacoKeyCode } from '@opensumi/monaco-editor-core';
import {
  AriaLabelProvider,
  Modifiers,
  UILabelProvider,
} from '@opensumi/monaco-editor-core/esm/vs/base/common/keybindingLabels';
import {
  ChordKeybinding,
  KeybindingModifier,
  ResolvedKeybinding,
  ResolvedKeybindingPart,
  SimpleKeybinding,
} from '@opensumi/monaco-editor-core/esm/vs/base/common/keyCodes';
import * as platform from '@opensumi/monaco-editor-core/esm/vs/base/common/platform';
import { USLayoutResolvedKeybinding } from '@opensumi/monaco-editor-core/esm/vs/platform/keybinding/common/usLayoutResolvedKeybinding';

import { KEY_CODE_MAP } from './monaco.keycode-map';

export class MonacoResolvedKeybinding extends ResolvedKeybinding {
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
    return this.parts.length >= 1;
  }

  public getDispatchParts(): (string | null)[] {
    return this.parts.map((part, index) => {
      const keyCode = KEY_CODE_MAP[this.keySequence[index].key!.keyCode];
      return USLayoutResolvedKeybinding.getDispatchStr(
        new SimpleKeybinding(
          part.modifiers.ctrlKey,
          part.modifiers.shiftKey,
          part.modifiers.altKey,
          part.modifiers.metaKey,
          keyCode,
        ),
      );
    });
  }

  getSingleModifierDispatchParts(): (KeybindingModifier | null)[] {
    return []; /* NOOP */
  }

  public getParts(): ResolvedKeybindingPart[] {
    return this.parts.map(
      (part) =>
        new ResolvedKeybindingPart(
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

  static keyCode(keybinding: SimpleKeybinding): KeyCode {
    const keyCode = keybinding.keyCode;
    const sequence: Keystroke = {
      first: Key.getKey(this.monaco2BrowserKeyCode(keyCode & 0xff)),
      modifiers: [],
    };
    if (keybinding.ctrlKey) {
      if (isOSX) {
        sequence.modifiers!.push(KeyModifier.MacCtrl);
      } else {
        sequence.modifiers!.push(KeyModifier.CtrlCmd);
      }
    }
    if (keybinding.shiftKey) {
      sequence.modifiers!.push(KeyModifier.Shift);
    }
    if (keybinding.altKey) {
      sequence.modifiers!.push(KeyModifier.Alt);
    }
    if (keybinding.metaKey && sequence.modifiers!.indexOf(KeyModifier.CtrlCmd) === -1) {
      sequence.modifiers!.push(KeyModifier.CtrlCmd);
    }
    return KeyCode.createKeyCode(sequence);
  }

  static keySequence(keybinding: ChordKeybinding): KeySequence {
    return keybinding.parts.map((part) => this.keyCode(part));
  }

  static monaco2BrowserKeyCode(keyCode: MonacoKeyCode): number {
    for (let i = 0; i < KEY_CODE_MAP.length; i++) {
      if (KEY_CODE_MAP[i] === keyCode) {
        return i;
      }
    }
    return -1;
  }
}
