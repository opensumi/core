import { GenericObjectType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';

import { Injectable, Autowired } from '@opensumi/di';
import { Emitter, Event, IJSONSchema } from '@opensumi/ide-core-common';

import { ILaunchService } from '../../common/debug-service';

type TFormData = { [key in string]: any };

@Injectable()
export class LaunchService implements ILaunchService {
  private readonly _onRawSchemaProperties = new Emitter<IJSONSchema>();
  public readonly onRawSchemaProperties: Event<IJSONSchema> = this._onRawSchemaProperties.event;

  private readonly _onChangeSchema = new Emitter<StrictRJSFSchema>();
  public readonly onChangeSchema: Event<StrictRJSFSchema> = this._onChangeSchema.event;

  private readonly _onChangeFormData = new Emitter<TFormData>();
  public readonly onChangeFormData: Event<TFormData> = this._onChangeFormData.event;

  private _rawSchemaProperties: IJSONSchema;
  private _schema: StrictRJSFSchema;
  private _formData: TFormData;

  public get rawSchemaProperties(): IJSONSchema {
    return this._rawSchemaProperties;
  }
  public get schema(): StrictRJSFSchema {
    return this._schema;
  }
  public get formData(): TFormData {
    return this._formData;
  }

  public setRawSchemaProperties(sp: IJSONSchema) {
    this._rawSchemaProperties = sp;
    this._onRawSchemaProperties.fire(sp);
  }

  public nextNewSchema(data: StrictRJSFSchema): void {
    this._schema = data;
    this._onChangeSchema.fire(data);
  }

  public nextNewFormData(data: TFormData): void {
    this._formData = data;
    this._onChangeFormData.fire(data);
  }

  public addNewItem(name: string): void {
    if (name === '') {
      return;
    }

    const { properties } = this.rawSchemaProperties;
    const newFormData = { ...this.formData };

    lodashSet(newFormData as GenericObjectType, name, properties![name]['default'] || '');
    lodashSet(this.schema.properties!, name, properties![name]);

    this.nextNewSchema(this.schema);
    this.nextNewFormData(newFormData);
  }

  public delItem(name: string): void {
    if (name === '') {
      return;
    }

    const { properties } = this.schema;
    const newFormData = { ...this.formData };

    delete newFormData[name];
    delete properties![name];

    this.nextNewSchema(this.schema);
    this.nextNewFormData(newFormData);
  }
}
