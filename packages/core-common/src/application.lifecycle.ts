import { Event } from '@opensumi/ide-utils';

export const enum LifeCyclePhase {
  /**
   * Before connected to the server.
   */
  Prepare = 1,
  /**
   * After connected to the server, enter the initialize phase.
   */
  Initialize,
  Starting,
  Ready,
}

export const AppLifeCycleServiceToken = Symbol('AppLifeCycleService');

export interface IAppLifeCycleService {
  phase: LifeCyclePhase;
  onDidLifeCyclePhaseChange: Event<LifeCyclePhase>;
}
