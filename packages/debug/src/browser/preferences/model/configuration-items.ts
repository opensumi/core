import { uuid } from '@opensumi/ide-core-common';

import { DebugConfiguration } from '../../../common';

export class ConfigurationItemsModel {
  private _uniqueID: string;
  public get uniqueID(): string {
    return this._uniqueID;
  }

  constructor(readonly label: string, readonly configuration: DebugConfiguration) {
    this._uniqueID = uuid(6);
  }
}
