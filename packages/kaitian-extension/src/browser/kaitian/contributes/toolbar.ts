import { Injectable, Autowired } from '@ali/common-di';

import { VSCodeContributePoint, Contributes } from '../../../common';
import { IToolbarButtonContribution, IToolbarSelectContribution } from '../types';
import { KaitianExtensionToolbarService } from '../main.thread.toolbar';
import { IToolbarRegistry } from '@ali/ide-core-browser';

export interface KtToolbarSchema {
  actions?: Array< IToolbarButtonContribution | IToolbarSelectContribution>;
  groups?: Array<{
    id: string,
    preferredLocation?: string,
    weight?: number,
  }>;
}

@Injectable()
@Contributes('toolbar')
export class KtToolbarContributionPoint extends VSCodeContributePoint<KtToolbarSchema> {

  @Autowired()
  private readonly kaitianExtToolbarService: KaitianExtensionToolbarService ;

  @Autowired(IToolbarRegistry)
  private readonly toolbarRegistry: IToolbarRegistry ;

  contribute() {
    if (this.json.groups) {
      for (const group of this.json.groups) {
        this.addDispose(this.toolbarRegistry.registerToolbarActionGroup({
          id: group.id,
          preferredLocation: group.preferredLocation,
          weight: group.weight,
        }));
      }
    }
    if (this.json.actions) {
      for (const toolbarAction of this.json.actions) {
        if (toolbarAction.type === 'button') {
          this.addDispose(this.kaitianExtToolbarService.registerToolbarButton(this.extension.id, this.extension.path, toolbarAction));
        } else if (toolbarAction.type === 'select') {
          this.addDispose(this.kaitianExtToolbarService.registerToolbarSelect(this.extension.id, this.extension.path, toolbarAction));
        }
      }
    }

  }
}
