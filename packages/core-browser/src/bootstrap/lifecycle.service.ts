import { Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-core-common';

export const AppLifeCycleServiceToken = Symbol('AppLifeCycleService');

export const enum LifeCyclePhase {
  Prepare = 1,
  Initialize = 2,
  Starting = 3,
  Ready = 4,
}

@Injectable()
export class AppLifeCycleService {
  private onDidChangeLifecyclePhaseEmitter: Emitter<LifeCyclePhase> = new Emitter();
  public onDidLifeCyclePhaseChange = this.onDidChangeLifecyclePhaseEmitter.event;

  private lifeCyclePhase: LifeCyclePhase;

  set phase(value: LifeCyclePhase) {
    this.lifeCyclePhase = value;
    this.onDidChangeLifecyclePhaseEmitter.fire(this.lifeCyclePhase);
  }

  get phase() {
    return this.lifeCyclePhase;
  }
}
