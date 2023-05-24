import { uuid } from '@opensumi/ide-core-common';

import { DebugConfiguration } from '../../../common';

export class ConfigurationItemsModel {
  private _uniqueID: string;
  private _description: string;

  public get uniqueID(): string {
    return this._uniqueID;
  }

  public get description(): string {
    return this._description;
  }

  constructor(readonly label: string, readonly configuration: DebugConfiguration) {
    this._uniqueID = uuid(6);
  }

  public setDescription(data: string): void {
    this._description = data;
  }
}
