import { Injectable } from '@ali/common-di';
import { IDebugService } from '../common';
import { IJSONSchema } from '@ali/ide-core-browser';

@Injectable()
export class DebugService implements IDebugService {
  private debugContributionPointsMap: Map<string, IJSONSchema[]> = new Map();

  registerDebugContributionPoints(extensionFolder: string, contributions: IJSONSchema[]) {
    if (!this.debugContributionPointsMap.has(extensionFolder)) {
      this.debugContributionPointsMap.set(extensionFolder, contributions);
    }
  }

  get debugContributionPoints() {
    return this.debugContributionPointsMap;
  }
}
