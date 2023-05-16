import { RJSFSchema } from '@rjsf/utils';

import { Injectable, Autowired } from '@opensumi/di';
import { Emitter, Event, IJSONSchema } from '@opensumi/ide-core-common';

import { ILaunchService } from '../../common/debug-service';

@Injectable()
export class LaunchService implements ILaunchService {
  private readonly _onChangeSchemaProperties = new Emitter<IJSONSchema>();
  public readonly onChangeSchemaProperties: Event<IJSONSchema> = this._onChangeSchemaProperties.event;

  private readonly _onAddNewProperties = new Emitter<IJSONSchema>();
  public readonly onAddNewProperties: Event<IJSONSchema> = this._onAddNewProperties.event;

  private _currentSchemaProperties: IJSONSchema;
  public get currentSchemaProperties(): IJSONSchema {
    return this._currentSchemaProperties;
  }

  public setCurrentSchemaProperties(sp: IJSONSchema) {
    this._currentSchemaProperties = sp;
    this._onChangeSchemaProperties.fire(sp);
  }

  public nextNewFormData(data: IJSONSchema): void {
    this._onAddNewProperties.fire(data);
  }
}
