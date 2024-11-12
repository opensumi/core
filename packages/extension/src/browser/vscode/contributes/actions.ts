import { Autowired, Injectable } from '@opensumi/di';
import { CommandService, getIcon } from '@opensumi/ide-core-browser';
import {
  IToolbarActionGroup,
  IToolbarActionService,
} from '@opensumi/ide-core-browser/lib/menu/next/toolbar-action.service';
import { LifeCyclePhase } from '@opensumi/ide-core-common';

import { Contributes, LifeCycle, VSCodeContributePoint } from '../../../common';

export interface ActionContribution {
  type: 'action';
  icon: string;
  command: string;
  title: string;
  description?: string;
}

export interface EnumContribution {
  type: 'enum';
  command: string;
  title: string;
  enum: string[];
  defaultValue?: string;
  description?: string;
}

export type ActionContributionSchema = Array<ActionContribution | EnumContribution>;

@Injectable()
@Contributes('actions')
@LifeCycle(LifeCyclePhase.Starting)
export class ActionsContributionPoint extends VSCodeContributePoint<ActionContributionSchema> {
  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IToolbarActionService)
  private readonly toolbarActionService: IToolbarActionService;

  contribute() {
    const _this = this;
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const actions: IToolbarActionGroup = [];
      for (const item of contributes) {
        const { title, description } = item;
        switch (item.type) {
          case 'action':
            actions.push({
              title,
              description,
              iconClass: getIcon(item.icon),
              click: () => {
                if (item.command) {
                  _this.commandService.executeCommand(item.command);
                }
              },
              type: item.type,
            });
            break;
          case 'enum':
            actions.push({
              type: item.type,
              title,
              description,
              select: (value) => {
                if (item.command) {
                  _this.commandService.executeCommand(item.command, value);
                }
              },
              enum: item.enum,
              defaultValue: item.defaultValue,
            });
            break;
        }
      }
      this.addDispose(this.toolbarActionService.registryActionGroup(extensionId, actions));
    }
  }

  // TODO: dispose
  dispose() {
    super.dispose();
  }
}
