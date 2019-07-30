import { KeySequence, KeybindingRegistry } from '@ali/ide-core-browser';
import { KEY_CODE_MAP } from './monaco.keycode-map';

export class MonacoResolvedKeybinding extends monaco.keybindings.ResolvedKeybinding {

  protected readonly parts: { key: string | null, modifiers: monaco.keybindings.Modifiers }[];

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
      return monaco.keybindings.UILabelProvider
                .toLabel(monaco.platform.OS,
                            this.parts.map((part) => part.modifiers),
                            this.keyLabelProvider);
  }

  public getAriaLabel(): string | null {
    return monaco.keybindings.AriaLabelProvider
                .toLabel(monaco.platform.OS,
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
      return this.parts.map((part, index) =>
        monaco.keybindings.USLayoutResolvedKeybinding.getDispatchStr(new monaco.keybindings.SimpleKeybinding(
            part.modifiers.ctrlKey,
            part.modifiers.shiftKey,
            part.modifiers.altKey,
            part.modifiers.metaKey,
            KEY_CODE_MAP[this.keySequence[index].key!.keyCode],
        )));
  }

  private toKeybinding(index: number): monaco.keybindings.SimpleKeybinding | null {
      if (index >= this.keySequence.length) {
          return null;
      }
      const keyCode = this.keySequence[index];
      return new monaco.keybindings.SimpleKeybinding(
          keyCode.ctrl,
          keyCode.shift,
          keyCode.alt,
          keyCode.meta,
          KEY_CODE_MAP[keyCode.key!.keyCode],
      );
  }

  public getParts(): monaco.keybindings.ResolvedKeybindingPart[] {
      return this.parts.map((part) =>  new monaco.keybindings.ResolvedKeybindingPart(
        part.modifiers.ctrlKey,
        part.modifiers.shiftKey,
        part.modifiers.altKey,
        part.modifiers.metaKey,
        part.key!,
        part.key!,
    ));
  }

  private keyLabelProvider<T extends monaco.keybindings.Modifiers>(keybinding: T): string | null {
    // TODO 实现不同环境的 keyLabelProvider
    return '';
  }

}
