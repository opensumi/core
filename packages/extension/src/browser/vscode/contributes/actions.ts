import { Injectable, Autowired } from '@opensumi/di';
import { getIcon, CommandService } from '@opensumi/ide-core-browser';
import {
  IToolbarActionService,
  IToolbarActionGroup,
} from '@opensumi/ide-core-browser/lib/menu/next/toolbar-action.service';
import { IToolBarViewService } from '@opensumi/ide-toolbar/lib/browser';

import { VSCodeContributePoint, Contributes } from '../../../common';

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
export class ActionsContributionPoint extends VSCodeContributePoint<ActionContributionSchema> {
  @Autowired(IToolBarViewService)
  toolbarViewService: IToolBarViewService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IToolbarActionService)
  private readonly toolbarActionService: IToolbarActionService;

  contribute() {
    this.register(this.json);
  }

  register(items: ActionContributionSchema) {
    const _this = this;
    const actions: IToolbarActionGroup = [];
    for (const item of items) {
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
    this.addDispose(this.toolbarActionService.registryActionGroup(this.extension.id, actions));
  }

  unregister() {
    this.toolbarActionService.unRegistryActionGroup(this.extension.id);
  }

  dispose() {
    super.dispose();

    this.unregister();
  }
}
