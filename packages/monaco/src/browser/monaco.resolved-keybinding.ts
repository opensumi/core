import { ResolvedKeybinding, ResolvedKeybindingPart, SimpleKeybinding } from '@ali/monaco-editor-core/esm/vs/base/common/keyCodes';
import { AriaLabelProvider, Modifiers, UILabelProvider } from '@ali/monaco-editor-core/esm/vs/base/common/keybindingLabels';
import { USLayoutResolvedKeybinding } from '@ali/monaco-editor-core/esm/vs/platform/keybinding/common/usLayoutResolvedKeybinding';
import * as platform from '@ali/monaco-editor-core/esm/vs/base/common/platform';
import { KeySequence, KeybindingRegistry } from '@ali/ide-core-browser';
import { KEY_CODE_MAP } from './monaco.keycode-map';

export class MonacoResolvedKeybinding extends ResolvedKeybinding {

  protected readonly parts: { key: string | null, modifiers: Modifiers }[];

  constructor(protected readonly keySequence: KeySequence, keybindingService: KeybindingRegistry) {
    super();
    this.parts = keySequence.map((keyCode) => ({
      key: keyCode.key ? keybindingService.acceleratorForKey(keyCode.key) : null,
      modifiers: {
        ctrlKey: keyCode.ctrl,
        shiftKey: keyCode.shift,
        altKey: keyCode.alt,
        metaKey: keyCode.meta,
      },
    }));
  }

  public getLabel(): string | null {
    return UILabelProvider
      .toLabel(platform.OS,
        this.parts.map((part) => part.modifiers),
        this.keyLabelProvider);
  }

  public getAriaLabel(): string | null {
    return AriaLabelProvider
      .toLabel(platform.OS,
        this.parts.map((part) => part.modifiers),
        this.keyLabelProvider);
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
      return USLayoutResolvedKeybinding.getDispatchStr(new SimpleKeybinding(
        part.modifiers.ctrlKey,
        part.modifiers.shiftKey,
        part.modifiers.altKey,
        part.modifiers.metaKey,
        keyCode,
      ));
    });
  }

  // FIXME: @蛋总 这个貌似并没有被调用
  protected toKeybinding(index: number): SimpleKeybinding | null {
    if (index >= this.keySequence.length) {
      return null;
    }
    const keyCode = this.keySequence[index];
    return new SimpleKeybinding(
      keyCode.ctrl,
      keyCode.shift,
      keyCode.alt,
      keyCode.meta,
      KEY_CODE_MAP[keyCode.key!.keyCode],
    );
  }

  public getParts(): ResolvedKeybindingPart[] {
    return this.parts.map((part) => new ResolvedKeybindingPart(
      part.modifiers.ctrlKey,
      part.modifiers.shiftKey,
      part.modifiers.altKey,
      part.modifiers.metaKey,
      part.key!,
      part.key!,
    ));
  }

  private keyLabelProvider<T extends Modifiers>(keybinding: T): string | null {
    // TODO 实现不同环境的 keyLabelProvider
    return '';
  }

}
