import { Injectable, Autowired } from '@opensumi/di';
import { IJSONSchema, IToolbarRegistry } from '@opensumi/ide-core-browser';
import { toolbar } from '@opensumi/ide-core-browser/lib/extensions/schema/toolbar';

import { VSCodeContributePoint, Contributes } from '../../../common';
import { KaitianExtensionToolbarService } from '../main.thread.toolbar';
import {
  IToolbarButtonContribution,
  IToolbarSelectContribution,
  IToolbarActionBasicContribution,
  IToolbarDropdownButtonContribution,
} from '../types';

export interface KtToolbarSchema {
  actions?: Array<IToolbarButtonContribution | IToolbarSelectContribution | IToolbarDropdownButtonContribution>;
  groups?: Array<{
    id: string;
    preferredLocation?: string;
    weight?: number;
  }>;
}

@Injectable()
@Contributes('toolbar')
export class ToolbarContributionPoint extends VSCodeContributePoint<KtToolbarSchema> {
  @Autowired()
  private readonly kaitianExtToolbarService: KaitianExtensionToolbarService;

  @Autowired(IToolbarRegistry)
  private readonly toolbarRegistry: IToolbarRegistry;

  static schema: IJSONSchema = toolbar.schema;

  private toLocalized<T extends IToolbarActionBasicContribution>(action: T, props: string[]): T {
    return props.reduce((pre, cur) => {
      if (pre[cur]) {
        pre[cur] = this.getLocalizeFromNlsJSON(pre[cur]);
      }
      return pre;
    }, action);
  }

  contribute() {
    if (this.json.groups) {
      for (const group of this.json.groups) {
        this.addDispose(
          this.toolbarRegistry.registerToolbarActionGroup({
            id: group.id,
            preferredLocation: group.preferredLocation,
            weight: group.weight,
          }),
        );
      }
    }
    if (this.json.actions) {
      for (const toolbarAction of this.json.actions) {
        switch (toolbarAction.type) {
          case 'button':
            this.addDispose(
              this.kaitianExtToolbarService.registerToolbarButton(
                this.extension.id,
                this.extension.path,
                this.toLocalized(toolbarAction, ['title']),
              ),
            );
            break;
          case 'select':
            this.addDispose(
              this.kaitianExtToolbarService.registerToolbarSelect(
                this.extension.id,
                this.extension.path,
                this.toLocalized(toolbarAction, ['description']),
              ),
            );
            break;
          case 'dropdownButton':
            this.addDispose(
              this.kaitianExtToolbarService.registerToolbarDropdownButton(
                this.extension.id,
                this.extension.path,
                this.toLocalized(toolbarAction, ['description']),
              ),
            );
            break;
        }
      }
    }
  }
}
