import { Injectable } from '@opensumi/common-di';
import { IDebugService, IDebugServiceContributionPoint } from '../common';
import { IJSONSchema, Event, Emitter } from '@opensumi/ide-core-browser';

@Injectable()
export class DebugService implements IDebugService {
  private onDidDebugContributionPointChangeEmitter: Emitter<IDebugServiceContributionPoint> = new Emitter<IDebugServiceContributionPoint>();

  private debugContributionPointsMap: Map<string, IJSONSchema[]> = new Map();

  registerDebugContributionPoints(path: string, contributions: IJSONSchema[]) {
    if (!this.debugContributionPointsMap.has(path)) {
      this.debugContributionPointsMap.set(path, contributions);
      this.onDidDebugContributionPointChangeEmitter.fire({
        path,
        contributions,
      });
    }
  }

  unregisterDebugContributionPoints(path: string) {
    const contributions = this.debugContributionPointsMap.get(path);
    if (contributions) {
      this.debugContributionPointsMap.delete(path);
      this.onDidDebugContributionPointChangeEmitter.fire({
        path,
        contributions,
        removed: true,
      });
    }
  }

  get debugContributionPoints() {
    return this.debugContributionPointsMap;
  }

  get onDidDebugContributionPointChange(): Event<IDebugServiceContributionPoint> {
    return this.onDidDebugContributionPointChangeEmitter.event;
  }
}
