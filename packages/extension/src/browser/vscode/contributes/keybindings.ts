// import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@opensumi/di';
import { KeybindingRegistry, OS, Keybinding, KeybindingWeight } from '@opensumi/ide-core-browser';

import { VSCodeContributePoint, Contributes } from '../../../common';

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
export class KeybindingContributionPoint extends VSCodeContributePoint<KeybindingSchema> {
  @Autowired(KeybindingRegistry)
  protected readonly keybindingRegistry: KeybindingRegistry;

  contribute() {
    const keybindings: Keybinding[] = this.json.map((contributedKeyBinding: ContributedKeyBinding) =>
      this.toKeybinding(contributedKeyBinding, this.extension.isBuiltin),
    );

    this.addDispose(this.keybindingRegistry.registerKeybindings(keybindings));
  }

  protected toKeybinding(contributedKeyBinding: ContributedKeyBinding, isBuiltin: boolean): Keybinding {
    const keybinding = this.toOSKeybinding(contributedKeyBinding);
    const { command, when } = contributedKeyBinding;
    return {
      keybinding,
      command,
      when,
      priority: isBuiltin ? KeybindingWeight.BuiltinExtension * 100 : KeybindingWeight.ExternalExtension * 100,
    };
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
