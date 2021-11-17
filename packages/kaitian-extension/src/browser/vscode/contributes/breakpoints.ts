import { VSCodeContributePoint, Contributes } from '../../../common';
import { Injectable, Autowired } from '@ide-framework/common-di';
import { DebugConfigurationManager } from '@ide-framework/ide-debug/lib/browser';

export interface BreakpointsContributionScheme {
  language: string;
}

@Injectable()
@Contributes('breakpoints')
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
