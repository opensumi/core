import { Injectable, Autowired } from '@opensumi/di';
import { KeybindingRegistry, OS, Keybinding, KeybindingWeight, OperatingSystem } from '@opensumi/ide-core-browser';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

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
@LifeCycle(LifeCyclePhase.Ready)
export class KeybindingContributionPoint extends VSCodeContributePoint<KeybindingSchema> {
  @Autowired(KeybindingRegistry)
  protected readonly keybindingRegistry: KeybindingRegistry;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }
      const keybindings: Keybinding[] = contributes.map((contributedKeyBinding: ContributedKeyBinding) =>
        this.toKeybinding(contributedKeyBinding, extension.isBuiltin),
      );
      this.addDispose(this.keybindingRegistry.registerKeybindings(keybindings));
    }
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
    if (os === OperatingSystem.Windows && ContributedKeyBinding.win) {
      keybinding = ContributedKeyBinding.win;
    } else if (os === OperatingSystem.Macintosh && ContributedKeyBinding.mac) {
      keybinding = ContributedKeyBinding.mac;
    } else if (ContributedKeyBinding.linux) {
      keybinding = ContributedKeyBinding.linux;
    }
    return keybinding || ContributedKeyBinding.key;
  }
}
