import { VscodeContributionPoint, Contributes } from './common';
import { Injectable } from '@ali/common-di';

export interface BreakpointsContributionScheme {
  language: string;
}

@Injectable()
@Contributes('breakpoints')
export class ColorsContributionPoint extends VscodeContributionPoint<BreakpointsContributionScheme[]> {
  contribute() {
  }
}
