import { Event } from '@opensumi/ide-utils';

export const enum LifeCyclePhase {
  Prepare = 1,
  Initialize = 2,
  Starting = 3,
  Ready = 4,
}

export const AppLifeCycleServiceToken = Symbol('AppLifeCycleService');

export interface IAppLifeCycleService {
  phase: LifeCyclePhase;
  onDidLifeCyclePhaseChange: Event<LifeCyclePhase>;
}
