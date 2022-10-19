import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { DebugConfigurationManager } from '@opensumi/ide-debug/lib/browser';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

export interface BreakpointsContributionScheme {
  language: string;
}

@Injectable()
@Contributes('breakpoints')
@LifeCycle(LifeCyclePhase.Starting)
export class BreakpointsContributionPoint extends VSCodeContributePoint<BreakpointsContributionScheme[]> {
  @Autowired(DebugConfigurationManager)
  private debugConfigurationManager: DebugConfigurationManager;

  contribute() {
    this.register(this.json);
  }

  register(items: BreakpointsContributionScheme[]) {
    items.forEach((item) => {
      this.debugConfigurationManager.addSupportBreakpoints(item.language);
    });
  }

  unregister(items: BreakpointsContributionScheme[]) {
    items.forEach((item) => {
      this.debugConfigurationManager.removeSupportBreakpoints(item.language);
    });
  }

  dispose() {
    this.unregister(this.json);
  }
}
