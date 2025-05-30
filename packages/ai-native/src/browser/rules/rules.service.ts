import { Injectable } from '@opensumi/di';
import { Disposable, Emitter } from '@opensumi/ide-core-common';

@Injectable()
export class RulesService extends Disposable {
  private readonly rulesChangeEventEmitter = new Emitter<void>();

  get onRulesChange() {
    return this.rulesChangeEventEmitter.event;
  }
}
