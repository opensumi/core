import { Autowired } from '@opensumi/di';
import { CommandRegistry, SlotLocation, ClientAppContribution } from '@opensumi/ide-core-browser';
import { CommandContribution, Domain } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { CodeAPIProvider } from './code-api.provider';
import { CodePlatform, ICodeAPIProvider } from './common/types';

@Domain(CommandContribution, ClientAppContribution)
export class CodeAPIContribution implements CommandContribution, ClientAppContribution {
  @Autowired(ICodeAPIProvider)
  codeAPI: CodeAPIProvider;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  registerCommands(registry: CommandRegistry) {
    registry.afterExecuteCommand(`workbench.view.${CodePlatform.github}`, () => {
      this.codeAPI.github.refresh();
    });
  }

  onDidStart() {
    this.layoutService.getTabbarService(SlotLocation.left).onCurrentChange(({ currentId, previousId }) => {
      if (previousId !== currentId && currentId === CodePlatform.github) {
        this.codeAPI.github.refresh();
      }
    });
  }
}
