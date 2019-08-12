import { Injectable, Autowired } from '@ali/common-di';
import { VscodeContributionPoint, Contributes } from './common';
import { ConfigurationsSchema } from './configuration';
import { KeybindingRegistry, OS, Keybinding } from '@ali/ide-core-browser';
import { EditorKeybindingContexts } from '@ali/ide-editor/lib/browser/editor.keybinding.contexts';

export interface ContributedKeyBinding {
  command: string;
  args?: any;
  key: string;
  when?: string;
  mac?: string;
  linux?: string;
  win?: string;
}

export type KeybindingSchema = Array<ContributedKeyBinding>;

@Injectable()
@Contributes('keybindings')
export class KeybindingContributionPoint extends VscodeContributionPoint<KeybindingSchema> {

  @Autowired(KeybindingRegistry)
  protected readonly keybindingRegistry: KeybindingRegistry;

  contribute() {
    const keybindings: Keybinding[] = this.json.map((contributedKeyBinding: ContributedKeyBinding) => (
      this.toKeybinding(contributedKeyBinding)),
    );

    this.addDispose(this.keybindingRegistry.registerKeybindings(...keybindings));
  }

  protected toKeybinding(contributedKeyBinding: ContributedKeyBinding): Keybinding {
    const keybinding = this.toOSKeybinding(contributedKeyBinding);
    const { command, when } = contributedKeyBinding;
    return { keybinding, command, when };
  }

  protected toOSKeybinding(ContributedKeyBinding: ContributedKeyBinding): string {
    let keybinding: string | undefined;
    const os = OS.type();
    if (os === OS.Type.Windows && ContributedKeyBinding.win) {
      keybinding = ContributedKeyBinding.win;
    } else if (os === OS.Type.OSX && ContributedKeyBinding.mac) {
      keybinding = ContributedKeyBinding.mac;
    } else if (ContributedKeyBinding.linux) {
      keybinding = ContributedKeyBinding.linux;
    }
    return keybinding || ContributedKeyBinding.key;
  }

}
