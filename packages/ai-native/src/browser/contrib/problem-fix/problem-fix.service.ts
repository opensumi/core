import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { MarkerHover } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/hover/browser/markerHoverParticipant';

@Injectable()
export class ProblemFixService {
  private readonly _onHoverFixTrigger = new Emitter<MarkerHover>();
  public readonly onHoverFixTrigger: Event<MarkerHover> = this._onHoverFixTrigger.event;

  public triggerHoverFix(isTrigger: MarkerHover) {
    this._onHoverFixTrigger.fire(isTrigger);
  }
}
