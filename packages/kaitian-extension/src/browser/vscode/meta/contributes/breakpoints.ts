import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable } from '@ali/common-di';

export interface BreakpointsContributionScheme {
  language: string;
}

@Injectable()
@Contributes('breakpoints')
export class BreakpointsContributionPoint extends VSCodeContributePoint<BreakpointsContributionScheme[]> {
  contribute() {
  }
}
